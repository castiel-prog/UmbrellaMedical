using System.Data;
using System.Globalization;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.DTOs.Store;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

/// <summary>
/// The clinic store: products, orders paid by card and collected at the clinic pharmacy desk.
/// Prescription-only products need a valid prescription code of the patient, or an uploaded prescription that staff check.
/// </summary>
[ApiController]
[Route("api/store")]
[Authorize]
public class StoreController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IPaymentGateway _gateway;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;
    private readonly IFileStorage _storage;
    private readonly ILogger<StoreController> _logger;

    public StoreController(
        UmbrellaDbContext db, ICurrentUser current, IPaymentGateway gateway, INotificationService notifications,
        IAuditService audit, IClinicClock clock, IFileStorage storage, ILogger<StoreController> logger)
    {
        _db = db;
        _current = current;
        _gateway = gateway;
        _notifications = notifications;
        _audit = audit;
        _clock = clock;
        _storage = storage;
        _logger = logger;
    }

    private static readonly Expression<Func<Product, ProductDto>> ProductProjection = p => new ProductDto
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Unit = p.Unit,
        Category = p.Category,
        Price = p.Price,
        Stock = p.Stock,
        IsActive = p.IsActive,
        RequiresPrescription = p.RequiresPrescription,
        MedicationId = p.MedicationId,
        MedicationName = p.Medication != null ? p.Medication.Name + " " + p.Medication.Strength : null,
        ImageUrl = p.ImageKey == null ? null : "/api/store/products/" + p.Id + "/image?v=" + p.ImageVersion
    };

    private const long MaxImageBytes = 3 * 1024 * 1024;

    private static readonly Expression<Func<StoreOrder, StoreOrderDto>> OrderProjection = o => new StoreOrderDto
    {
        Id = o.Id,
        OrderNumber = o.OrderNumber,
        Status = o.Status,
        Total = o.Total,
        CreatedAt = o.CreatedAt,
        PaidAt = o.PaidAt,
        PaymentReference = o.PaymentReference,
        Refunded = o.Refunded,
        PatientId = o.PatientId,
        PatientName = o.Patient.FirstName + " " + o.Patient.LastName,
        PatientPersonalNumber = o.Patient.PersonalNumber,
        PrescriptionDocumentId = o.PrescriptionDocumentId,
        PrescriptionFileName = o.PrescriptionDocument != null ? o.PrescriptionDocument.FileName : null,
        ReviewNote = o.ReviewNote,
        ReviewedAt = o.ReviewedAt,
        CompletedAt = o.CompletedAt,
        Items = o.Items.Select(i => new StoreOrderItemDto
        {
            ProductId = i.ProductId,
            ProductName = i.ProductName,
            RequiresPrescription = i.Product.RequiresPrescription,
            UnitPrice = i.UnitPrice,
            Quantity = i.Quantity,
            LineTotal = i.LineTotal,
            PrescriptionCode = i.Prescription != null ? i.Prescription.Code : null
        }).ToList()
    };

    // ---------------------------------------------------------------- products

    [HttpGet("products")]
    [AllowAnonymous]
    public async Task<ActionResult<List<ProductDto>>> Products(
        [FromQuery] ProductCategory? category, [FromQuery] string? search, [FromQuery] bool includeInactive = false)
    {
        var query = _db.Products.AsNoTracking().AsQueryable();
        if (!(includeInactive && _current.Role == "Admin")) query = query.Where(p => p.IsActive);
        if (category is not null) query = query.Where(p => p.Category == category);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Name.Contains(term) || (p.Description != null && p.Description.Contains(term)));
        }

        return Ok(await query.OrderBy(p => p.Category).ThenBy(p => p.Name).Select(ProductProjection).ToListAsync());
    }

    [HttpGet("products/{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<ProductDto>> Product(int id)
    {
        var dto = await _db.Products.AsNoTracking().Where(p => p.Id == id && (p.IsActive || _current.Role == "Admin"))
            .Select(ProductProjection).FirstOrDefaultAsync();
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("products")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> CreateProduct(UpsertProductRequest request)
    {
        var error = await ValidateProductAsync(request, null);
        if (error is not null) return error;

        var product = new Product();
        Apply(product, request);
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedProduct", nameof(Product), product.Id);
        return Ok(await _db.Products.AsNoTracking().Where(p => p.Id == product.Id).Select(ProductProjection).FirstAsync());
    }

    [HttpPut("products/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> UpdateProduct(int id, UpsertProductRequest request)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound();

        var error = await ValidateProductAsync(request, id);
        if (error is not null) return error;

        Apply(product, request);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedProduct", nameof(Product), id);
        return Ok(await _db.Products.AsNoTracking().Where(p => p.Id == id).Select(ProductProjection).FirstAsync());
    }

    /// <summary>The product photo. Public, so it can be shown to visitors and cached by browsers.</summary>
    [HttpGet("products/{id:int}/image")]
    [AllowAnonymous]
    public async Task<IActionResult> ProductImage(int id)
    {
        var key = await _db.Products.AsNoTracking().Where(p => p.Id == id).Select(p => p.ImageKey).FirstOrDefaultAsync();
        if (key is null) return NotFound();

        var stream = await _storage.OpenReadAsync(key);
        if (stream is null) return NotFound();

        // The URL carries a version number, so a long cache is safe: a new photo gets a new URL.
        Response.Headers.CacheControl = "public, max-age=604800";
        return File(stream, ImageContentType(key));
    }

    [HttpPost("products/{id:int}/image")]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(MaxImageBytes + 64 * 1024)]
    public async Task<ActionResult<ProductDto>> UploadProductImage(int id, IFormFile? file, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();

        if (file is null || file.Length == 0) return Invalid("file", "Choose a picture.");
        if (file.Length > MaxImageBytes) return Invalid("file", "The picture must be 3 MB or smaller.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension == ".jpeg") extension = ".jpg";
        if (extension is not (".png" or ".jpg" or ".webp")) return Invalid("file", "Use a PNG, JPG or WebP picture.");
        if (!await ImageSignatureMatchesAsync(file, extension, cancellationToken))
            return Invalid("file", "The file is not a valid PNG, JPG or WebP picture.");

        string key;
        await using (var stream = file.OpenReadStream())
            key = await _storage.SaveAsync(stream, extension, cancellationToken);

        var oldKey = product.ImageKey;
        product.ImageKey = key;
        product.ImageVersion++;
        await _db.SaveChangesAsync(cancellationToken);

        if (oldKey is not null) await _storage.DeleteAsync(oldKey);
        await _audit.LogAsync("UpdatedProductImage", nameof(Product), id);
        return Ok(await _db.Products.AsNoTracking().Where(p => p.Id == id).Select(ProductProjection).FirstAsync(cancellationToken));
    }

    [HttpDelete("products/{id:int}/image")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> DeleteProductImage(int id)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound();

        var oldKey = product.ImageKey;
        product.ImageKey = null;
        product.ImageVersion++;
        await _db.SaveChangesAsync();

        if (oldKey is not null) await _storage.DeleteAsync(oldKey);
        return Ok(await _db.Products.AsNoTracking().Where(p => p.Id == id).Select(ProductProjection).FirstAsync());
    }

    /// <summary>The logged-in patient's valid, unused prescriptions that allow buying this product.</summary>
    [HttpGet("products/{id:int}/my-prescriptions")]
    [Authorize(Roles = "Patient")]
    public async Task<ActionResult<List<UsablePrescriptionDto>>> MyPrescriptionsFor(int id)
    {
        var patientId = await _current.GetPatientIdAsync();
        if (patientId is null) return Forbid();

        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (product?.MedicationId is null) return Ok(new List<UsablePrescriptionDto>());

        var now = _clock.Now;
        var list = await _db.Prescriptions.AsNoTracking()
            .Where(p => p.PatientId == patientId.Value
                        && p.ExpiryDate >= now
                        && p.Code != null
                        && p.Items.Any(i => i.MedicationId == product.MedicationId)
                        && !_db.StoreOrderItems.Any(i => i.PrescriptionId == p.Id && i.ProductId == id
                                                         && i.StoreOrder.Status != StoreOrderStatus.Cancelled
                                                         && i.StoreOrder.Status != StoreOrderStatus.Rejected))
            .OrderByDescending(p => p.IssuedDate)
            .Select(p => new UsablePrescriptionDto
            {
                Id = p.Id,
                Code = p.Code!,
                DoctorName = "Dr. " + p.Doctor.FirstName + " " + p.Doctor.LastName,
                IssuedDate = p.IssuedDate,
                ExpiryDate = p.ExpiryDate
            })
            .ToListAsync();
        return Ok(list);
    }

    // ---------------------------------------------------------------- orders

    [HttpPost("orders")]
    [Authorize(Roles = "Patient")]
    public async Task<ActionResult<StoreOrderDto>> CreateOrder(CreateStoreOrderRequest request)
    {
        var patientId = await _current.GetPatientIdAsync();
        if (patientId is null) return Forbid();

        if (request.Items.Select(i => i.ProductId).Distinct().Count() != request.Items.Count)
            return Invalid("items", "Each product can appear only once; change the quantity instead.");

        var ids = request.Items.Select(i => i.ProductId).ToList();
        var products = await _db.Products.AsNoTracking().Where(p => ids.Contains(p.Id) && p.IsActive).ToDictionaryAsync(p => p.Id);
        if (products.Count != ids.Count) return Invalid("items", "One or more products are no longer available.");

        // An uploaded prescription file must be the patient's own, of type Prescription.
        if (request.PrescriptionDocumentId is not null
            && !await _db.MedicalDocuments.AnyAsync(d => d.Id == request.PrescriptionDocumentId
                                                         && d.PatientId == patientId.Value
                                                         && d.Type == DocumentType.Prescription))
            return Invalid(nameof(request.PrescriptionDocumentId), "The uploaded prescription was not found.");

        var now = _clock.Now;
        var needsReview = false;
        var lines = new List<StoreOrderItem>();

        foreach (var line in request.Items)
        {
            var product = products[line.ProductId];
            int? prescriptionId = null;

            if (product.RequiresPrescription)
            {
                if (!string.IsNullOrWhiteSpace(line.PrescriptionCode))
                {
                    var check = await CheckPrescriptionCodeAsync(line.PrescriptionCode, patientId.Value, product, now);
                    if (check.Error is not null) return Invalid("items", $"{product.Name}: {check.Error}");
                    prescriptionId = check.PrescriptionId;
                }
                else if (request.PrescriptionDocumentId is not null)
                {
                    needsReview = true;
                }
                else
                {
                    return Invalid("items",
                        $"{product.Name} needs a prescription. Enter your prescription code, upload a prescription, or request one from a doctor.");
                }
            }

            var lineTotal = BillingRules.Round(product.Price * line.Quantity);
            lines.Add(new StoreOrderItem
            {
                ProductId = product.Id,
                ProductName = product.Name,
                UnitPrice = product.Price,
                Quantity = line.Quantity,
                LineTotal = lineTotal,
                PrescriptionId = prescriptionId
            });
        }

        var total = lines.Sum(l => l.LineTotal);
        if (request.Card is null) return Invalid("card", "Please pay for the order to complete it.");

        string? chargeReference = null;
        var committed = false;
        int orderId;

        try
        {
            await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            // Take the items off the shelf first, so we never charge for something that is out of stock.
            var tracked = await _db.Products.Where(p => ids.Contains(p.Id)).ToListAsync();
            foreach (var line in lines)
            {
                var product = tracked.First(p => p.Id == line.ProductId);
                if (product.Stock < line.Quantity)
                    return Problem(
                        detail: product.Stock == 0
                            ? $"{product.Name} is out of stock."
                            : $"Only {product.Stock} of {product.Name} left in stock.",
                        statusCode: StatusCodes.Status409Conflict,
                        title: "Not enough stock");
                product.Stock -= line.Quantity;
            }

            var card = request.Card;
            var charge = await _gateway.ChargeAsync(total,
                new CardDetails(card.Number, card.ExpiryMonth, card.ExpiryYear, card.Cvc, card.HolderName),
                "Umbrella store order", HttpContext.RequestAborted);
            if (!charge.Success)
                return Problem(detail: charge.Error, statusCode: StatusCodes.Status402PaymentRequired, title: "Payment failed");
            chargeReference = charge.Reference;

            var order = new StoreOrder
            {
                OrderNumber = "TMP-" + Guid.NewGuid().ToString("N")[..20],
                Status = needsReview ? StoreOrderStatus.AwaitingReview : StoreOrderStatus.ReadyForPickup,
                Total = total,
                PaymentReference = chargeReference,
                PaidAt = now,
                PatientId = patientId.Value,
                PrescriptionDocumentId = needsReview ? request.PrescriptionDocumentId : null
            };
            foreach (var line in lines) order.Items.Add(line);

            _db.StoreOrders.Add(order);
            await _db.SaveChangesAsync();
            order.OrderNumber = $"ORD-{now.Year}-{order.Id:D6}";

            var userId = _current.UserId!.Value;
            _notifications.Queue(userId, needsReview ? "Order received: prescription check" : "Order ready for pickup",
                needsReview
                    ? $"Thank you! Order {order.OrderNumber} ({Money(total)}) is paid. Our staff are checking your prescription; we'll tell you when it's ready to collect. If it can't be accepted, you'll get a full refund."
                    : $"Thank you! Order {order.OrderNumber} ({Money(total)}) is paid and ready to collect at the clinic pharmacy desk. Please bring a photo ID.");

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            committed = true;
            orderId = order.Id;
        }
        catch (SqlException ex) when (ex.Number == 1205)
        {
            return Problem(detail: "Another order was being placed at the same time. Please try again.", statusCode: StatusCodes.Status409Conflict, title: "Please retry");
        }
        finally
        {
            if (!committed && chargeReference is not null && !await _gateway.RefundAsync(chargeReference, total, CancellationToken.None))
                _logger.LogError("Store order failed after charging {Reference}, and the automatic refund failed.", chargeReference);
        }

        await _audit.LogAsync("PlacedStoreOrder", nameof(StoreOrder), orderId);
        return Ok(await LoadOrderAsync(orderId));
    }

    /// <summary>Patients: their own orders. Reception and admins: all orders.</summary>
    [HttpGet("orders")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<PagedResult<StoreOrderDto>>> Orders(
        [FromQuery] StoreOrderStatus? status, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.StoreOrders.AsNoTracking().AsQueryable();

        if (_current.Role == "Patient")
        {
            var own = await _current.GetPatientIdAsync();
            if (own is null) return Forbid();
            query = query.Where(o => o.PatientId == own.Value);
        }
        else if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(o => o.OrderNumber.Contains(term)
                                     || (o.Patient.FirstName + " " + o.Patient.LastName).Contains(term)
                                     || o.Patient.PersonalNumber.Contains(term));
        }

        if (status is not null) query = query.Where(o => o.Status == status);

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(o => o.Status == StoreOrderStatus.AwaitingReview ? 0 : o.Status == StoreOrderStatus.ReadyForPickup ? 1 : 2)
            .ThenByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(OrderProjection)
            .ToListAsync();

        return Ok(new PagedResult<StoreOrderDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total });
    }

    [HttpGet("orders/{id:int}")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<StoreOrderDto>> Order(int id)
    {
        if (!await CanSeeOrderAsync(id)) return NotFound();
        return Ok(await LoadOrderAsync(id));
    }

    /// <summary>Staff accept the uploaded prescription; the order becomes ready for pickup.</summary>
    [HttpPost("orders/{id:int}/approve")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<StoreOrderDto>> Approve(int id, ReviewOrderRequest request)
    {
        var order = await _db.StoreOrders.Include(o => o.Patient).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();
        if (order.Status != StoreOrderStatus.AwaitingReview) return WrongStatus("Only orders waiting for a prescription check can be approved.");

        order.Status = StoreOrderStatus.ReadyForPickup;
        order.ReviewNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        order.ReviewedAt = _clock.Now;
        order.ReviewedByUserId = _current.UserId;
        NotifyPatient(order, "Prescription accepted: order ready",
            $"Your prescription for order {order.OrderNumber} was accepted. The order is ready to collect at the clinic pharmacy desk. Please bring a photo ID.");

        await _db.SaveChangesAsync();
        await _audit.LogAsync("ApprovedStoreOrder", nameof(StoreOrder), id);
        return Ok(await LoadOrderAsync(id));
    }

    /// <summary>Staff refuse the uploaded prescription; the order is refunded and the stock returned.</summary>
    [HttpPost("orders/{id:int}/reject")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<StoreOrderDto>> Reject(int id, RejectOrderRequest request)
    {
        var order = await LoadTrackedOrderAsync(id);
        if (order is null) return NotFound();
        if (order.Status != StoreOrderStatus.AwaitingReview) return WrongStatus("Only orders waiting for a prescription check can be rejected.");

        await RefundAndRestockAsync(order);
        order.Status = StoreOrderStatus.Rejected;
        order.ReviewNote = request.Reason.Trim();
        order.ReviewedAt = _clock.Now;
        order.ReviewedByUserId = _current.UserId;
        NotifyPatient(order, "Prescription not accepted: refunded",
            $"We couldn't accept the prescription for order {order.OrderNumber}. Reason: {order.ReviewNote} " +
            $"Your payment of {Money(order.Total)} was refunded to your card. You can request a prescription from a doctor and order again.");

        await _db.SaveChangesAsync();
        await _audit.LogAsync("RejectedStoreOrder", nameof(StoreOrder), id, order.ReviewNote);
        return Ok(await LoadOrderAsync(id));
    }

    /// <summary>The patient collected the order at the desk.</summary>
    [HttpPost("orders/{id:int}/complete")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<StoreOrderDto>> Complete(int id)
    {
        var order = await _db.StoreOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();
        if (order.Status != StoreOrderStatus.ReadyForPickup) return WrongStatus("Only orders that are ready for pickup can be handed over.");

        order.Status = StoreOrderStatus.Completed;
        order.CompletedAt = _clock.Now;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CompletedStoreOrder", nameof(StoreOrder), id);
        return Ok(await LoadOrderAsync(id));
    }

    /// <summary>The patient (or staff) cancels before pickup: full refund, stock returned.</summary>
    [HttpPost("orders/{id:int}/cancel")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<StoreOrderDto>> Cancel(int id)
    {
        if (!await CanSeeOrderAsync(id)) return NotFound();
        var order = await LoadTrackedOrderAsync(id);
        if (order is null) return NotFound();
        if (order.Status is not (StoreOrderStatus.AwaitingReview or StoreOrderStatus.ReadyForPickup))
            return WrongStatus("This order can no longer be cancelled.");

        await RefundAndRestockAsync(order);
        order.Status = StoreOrderStatus.Cancelled;
        order.ReviewedAt = _clock.Now;
        NotifyPatient(order, "Order cancelled: refunded",
            $"Order {order.OrderNumber} was cancelled and {Money(order.Total)} was refunded to your card.");

        await _db.SaveChangesAsync();
        await _audit.LogAsync("CancelledStoreOrder", nameof(StoreOrder), id);
        return Ok(await LoadOrderAsync(id));
    }

    /// <summary>The prescription file uploaded with an order, for the staff who check it (and the patient).</summary>
    [HttpGet("orders/{id:int}/prescription-file")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<IActionResult> PrescriptionFile(int id)
    {
        if (!await CanSeeOrderAsync(id)) return NotFound();
        var document = await _db.StoreOrders.AsNoTracking().Where(o => o.Id == id)
            .Select(o => o.PrescriptionDocument).FirstOrDefaultAsync();
        if (document is null) return NotFound();

        var stream = await _storage.OpenReadAsync(document.FileUrl);
        if (stream is null) return NotFound();

        if (_current.Role != "Patient") await _audit.LogAsync("ViewedOrderPrescription", nameof(StoreOrder), id);
        Response.Headers.CacheControl = "private, no-store";
        return File(stream, document.ContentType, document.FileName);
    }

    // ---------------------------------------------------------------- helpers

    private async Task<(int? PrescriptionId, string? Error)> CheckPrescriptionCodeAsync(string rawCode, int patientId, Product product, DateTime now)
    {
        var code = PrescriptionCodes.Normalize(rawCode);
        var prescription = await _db.Prescriptions.AsNoTracking()
            .Where(p => p.Code == code)
            .Select(p => new { p.Id, p.PatientId, p.ExpiryDate, MedicationIds = p.Items.Select(i => i.MedicationId).ToList() })
            .FirstOrDefaultAsync();

        // The same answer for "no such code" and "someone else's code", so codes can't be probed.
        if (prescription is null || prescription.PatientId != patientId)
            return (null, "this prescription code was not found on your account.");
        if (prescription.ExpiryDate < now)
            return (null, $"prescription {code} expired on {prescription.ExpiryDate:d MMM yyyy}.");
        if (product.MedicationId is null || !prescription.MedicationIds.Contains(product.MedicationId.Value))
            return (null, $"prescription {code} is not for this medicine.");

        var alreadyUsed = await _db.StoreOrderItems.AnyAsync(i => i.PrescriptionId == prescription.Id && i.ProductId == product.Id
                                                                  && i.StoreOrder.Status != StoreOrderStatus.Cancelled
                                                                  && i.StoreOrder.Status != StoreOrderStatus.Rejected);
        if (alreadyUsed) return (null, $"prescription {code} has already been used for this medicine.");

        return (prescription.Id, null);
    }

    private async Task RefundAndRestockAsync(StoreOrder order)
    {
        if (!order.Refunded && order.PaymentReference is not null)
        {
            order.Refunded = await _gateway.RefundAsync(order.PaymentReference, order.Total, HttpContext.RequestAborted);
            if (!order.Refunded) _logger.LogError("Refund failed for store order {OrderId}.", order.Id);
        }

        foreach (var item in order.Items)
            item.Product.Stock += item.Quantity;
    }

    private void NotifyPatient(StoreOrder order, string title, string message)
    {
        if (order.Patient.UserId is int userId) _notifications.Queue(userId, title, message);
    }

    private async Task<bool> CanSeeOrderAsync(int id)
    {
        if (_current.Role is "Admin" or "Receptionist") return await _db.StoreOrders.AnyAsync(o => o.Id == id);
        var patientId = await _current.GetPatientIdAsync();
        return patientId is not null && await _db.StoreOrders.AnyAsync(o => o.Id == id && o.PatientId == patientId.Value);
    }

    private Task<StoreOrder?> LoadTrackedOrderAsync(int id) =>
        _db.StoreOrders.Include(o => o.Patient).Include(o => o.Items).ThenInclude(i => i.Product).FirstOrDefaultAsync(o => o.Id == id);

    private Task<StoreOrderDto> LoadOrderAsync(int id) =>
        _db.StoreOrders.AsNoTracking().Where(o => o.Id == id).Select(OrderProjection).FirstAsync();

    private async Task<ActionResult?> ValidateProductAsync(UpsertProductRequest request, int? id)
    {
        var name = request.Name.Trim();
        if (await _db.Products.AnyAsync(p => p.Name == name && p.Id != id))
            return Invalid(nameof(request.Name), "A product with this name already exists.");
        if (request.RequiresPrescription && request.MedicationId is null)
            return Invalid(nameof(request.MedicationId), "Choose the medication a prescription must contain.");
        if (request.MedicationId is not null && !await _db.Medications.AnyAsync(m => m.Id == request.MedicationId))
            return Invalid(nameof(request.MedicationId), "This medication does not exist.");
        if (decimal.Round(request.Price, 2) != request.Price)
            return Invalid(nameof(request.Price), "Prices can have at most two decimal places.");
        return null;
    }

    private static void Apply(Product product, UpsertProductRequest request)
    {
        product.Name = request.Name.Trim();
        product.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? null : request.Unit.Trim();
        product.Category = request.Category;
        product.Price = request.Price;
        product.Stock = request.Stock;
        product.IsActive = request.IsActive;
        product.RequiresPrescription = request.RequiresPrescription;
        product.MedicationId = request.MedicationId;
    }

    private ActionResult WrongStatus(string detail) =>
        Problem(detail: detail, statusCode: StatusCodes.Status409Conflict, title: "Not possible now");

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private static string ImageContentType(string key) => Path.GetExtension(key).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "image/jpeg"
    };

    /// <summary>Checks the file really is the picture type its name claims, by its first bytes.</summary>
    private static async Task<bool> ImageSignatureMatchesAsync(IFormFile file, string extension, CancellationToken cancellationToken)
    {
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header.AsMemory(), header.Length, false, cancellationToken);

        return extension switch
        {
            ".png" => read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
                      && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A,
            ".jpg" => read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            ".webp" => read >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                       && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P',
            _ => false
        };
    }

    private static string Money(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture) + " GEL";
}

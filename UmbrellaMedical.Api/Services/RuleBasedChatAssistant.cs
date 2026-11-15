using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// The built-in help assistant: no AI and no API key. It recognises common questions by keywords
/// and answers from the live clinic directory (doctors, services, prices, hours) and fixed policy texts.
/// It never gives medical advice; symptoms are only mapped to the kind of specialist that usually helps.
/// </summary>
public partial class RuleBasedChatAssistant : IChatAssistant
{
    private static readonly CultureInfo C = CultureInfo.InvariantCulture;
    private readonly IClinicDirectory _directory;

    public RuleBasedChatAssistant(IClinicDirectory directory)
    {
        _directory = directory;
    }

    public string Mode => "faq";
    public bool IsConfigured => true;

    // ---------------------------------------------------------------- keywords

    private static readonly string[] Emergency =
    {
        "chest pain", "pain in my chest", "cant breathe", "can t breathe", "cannot breathe", "trouble breathing",
        "difficulty breathing", "not breathing", "stroke", "unconscious", "fainted", "passed out", "severe bleeding",
        "bleeding a lot", "heavy bleeding", "heart attack", "overdose", "poisoned", "poisoning", "choking",
        "emergency", "ambulance", "სასწრაფო", "скорая"
    };

    private static readonly string[] SelfHarm =
    {
        "kill myself", "suicide", "suicidal", "end my life", "hurt myself", "self harm", "want to die", "don t want to live",
        "dont want to live"
    };

    private static readonly string[] AskHuman =
    {
        "are you human", "are you a human", "are you a bot", "are you real", "real person", "talk to a human", "talk to someone",
        "speak to someone", "speak to a person", "live agent", "live chat", "operator", "talk to a person", "are you ai", "are you an ai"
    };

    private static readonly string[] MedicalAdvice =
    {
        "what medicine", "which medicine", "what medication", "which medication", "what pill", "which pill", "dosage", "dose",
        "how much should i take", "should i take", "diagnose", "diagnosis", "is it serious", "what do i have", "what s wrong with me",
        "is it cancer", "antibiotic", "treat it at home", "home remedy", "cure"
    };

    // A trailing space means "whole word only" (the normalized message always ends with a space).
    private static readonly string[] Greeting = { "hi ", "hello", "hey ", "good morning", "good afternoon", "good evening", "გამარჯობა", "привет", "здравствуйте" };
    private static readonly string[] Thanks = { "thank", "thanks", "thx", "appreciate", "მადლობ", "спасибо" };
    private static readonly string[] Bye = { "bye", "goodbye", "see you", "ნახვამდის", "пока" };

    /// <summary>Everyday words for each specialization (matched at the start of a word).</summary>
    private static readonly Dictionary<string, string[]> SpecialtyWords = new()
    {
        ["Dermatologist"] = new[] { "skin", "rash", "acne", "pimple", "eczema", "mole", "itch", "hair loss", "nail", "psoriasis", "dermat", "კან" },
        ["Dentist"] = new[] { "tooth", "teeth", "dental", "dentist", "gum ", "gums ", "cavity", "toothache", "filling", "braces", "კბილ", "зуб" },
        ["Cardiologist"] = new[] { "heart", "blood pressure", "hypertension", "palpitation", "cardio", "cholesterol", "ecg ", "გულ", "сердц" },
        ["Pediatrician"] = new[] { "child", "children", "kid ", "kids ", "baby", "babies", "infant", "toddler", "pediatric", "paediatric", "my son", "my daughter", "ბავშვ" },
        ["General Practitioner"] = new[] { "general practitioner", "family doctor", "gp ", "checkup", "check up", "fever", "cold ", "flu ", "cough", "tired", "fatigue", "თერაპევტ", "терапевт" },
        ["Radiologist"] = new[] { "xray", "radiolog", "imaging", "scan ", "scans ", "რენტგენ", "рентген" },
        ["Neurologist"] = new[] { "headache", "migraine", "dizz", "numb ", "numbness", "tingling", "epilep", "nerve", "neurolog", "memory problem", "ნევროლოგ", "невролог" },
        ["Orthopedist"] = new[] { "knee", "back pain", "my back", "joint", "bone", "fracture", "broken", "shoulder", "sprain", "sport injur", "sports injur", "hip ", "hips ", "ankle", "ortho", "ორთოპედ", "ортопед" },
        ["Ophthalmologist"] = new[] { "eye", "vision", "glasses", "sight", "blurry", "ophthalm", "თვალ", "глаз" },
        ["Otolaryngologist (ENT)"] = new[] { "ear ", "ears ", "earache", "nose", "throat", "sinus", "hearing", "tonsil", "ent ", "snoring", "ყურ", "лор" },
        ["Gynecologist"] = new[] { "pregnan", "gyneco", "gynaeco", "period", "menstru", "women s health", "womens health", "contracept", "გინეკოლოგ", "гинеколог" },
        ["Psychiatrist"] = new[] { "anxiety", "anxious", "depress", "stress", "panic", "mental", "insomnia", "can t sleep", "cant sleep", "burnout", "psychiat", "therapy", "ფსიქიატრ", "психиатр" },
        ["Endocrinologist"] = new[] { "diabet", "thyroid", "hormon", "blood sugar", "endocrin", "metabol", "ენდოკრინოლოგ", "эндокринолог" },
        ["Urologist"] = new[] { "kidney", "bladder", "urin", "prostate", "urolog", "უროლოგ", "уролог" }
    };

    // Order matters for ties: specific topics first, broad ones (booking, price, doctors) last.
    private enum Topic
    {
        Cancel, Reschedule, Password, Login, Register, Payment, Insurance, Bills, Records, Notifications,
        Reviews, Profile, Contact, Hours, Credentials, Price, Booking, Services, Specializations, Doctors
    }

    /// <summary>Broad topics that are dropped when a more specific one also matched.</summary>
    private static readonly HashSet<Topic> BroadTopics = new() { Topic.Booking, Topic.Price, Topic.Services, Topic.Specializations, Topic.Doctors };

    private static readonly (Topic Topic, string[] Words)[] TopicWords =
    {
        (Topic.Booking, new[] { "book", "booking", "appointment", "make an appointment", "reserve", "schedule a", "get a visit", "ჯავშ", "დაჯავშნ", "записат", "запись" }),
        (Topic.Payment, new[] { "pay", "payment", "card", "cash", "upfront", "up front", "charge", "visa", "mastercard", "გადახდ", "оплат" }),
        (Topic.Cancel, new[] { "cancel", "refund", "money back", "გაუქმ", "отмен", "возврат" }),
        (Topic.Reschedule, new[] { "reschedul", "change the time", "change my appointment", "move my appointment", "different time", "another time", "change the date" }),
        (Topic.Insurance, new[] { "insur", "coverage", "covered", "დაზღვ", "страхов" }),
        (Topic.Hours, new[] { "hours", "open", "opening", "closing", "what time", "when are you", "saturday", "sunday", "weekend", "closed", "სამუშაო საათ" }),
        (Topic.Register, new[] { "register", "sign up", "signup", "create an account", "new account", "რეგისტრაც", "регистрац" }),
        (Topic.Login, new[] { "log in", "login", "sign in", "can t log", "cannot log", "cant log", "logged out" }),
        (Topic.Password, new[] { "password", "forgot", "reset", "პაროლ", "пароль" }),
        (Topic.Bills, new[] { "invoice", "receipt", "bill", "bills", "paid", "ქვითარ", "счет", "чек" }),
        (Topic.Records, new[] { "record", "prescription", "medical history", "document", "test result", "lab result", "results", "upload", "allerg" }),
        (Topic.Notifications, new[] { "notification", "remind", "reminder", "alert", "email me" }),
        (Topic.Reviews, new[] { "review", "rate", "rating", "feedback", "stars" }),
        (Topic.Profile, new[] { "profile picture", "profile photo", "photo", "avatar", "change my email", "change email", "my profile", "my account" }),
        (Topic.Contact, new[] { "address", "location", "where are you", "where is the clinic", "phone", "contact", "call you", "parking", "directions", "how to get", "მისამართ", "адрес" }),
        (Topic.Price, new[] { "price", "prices", "cost", "how much", "fee", "expensive", "cheap", "ფას", "ღირ", "сколько", "цен", "стоимост" }),
        (Topic.Doctors, new[] { "doctor", "doctors", "specialist", "who works", "ექიმ", "врач" }),
        (Topic.Specializations, new[] { "specialization", "specialisation", "specialities", "specialties", "department", "what kind of doctor", "which doctor", "what doctor" }),
        (Topic.Services, new[] { "services", "what do you offer", "treatments", "procedures", "სერვის", "услуг" }),
        (Topic.Credentials, new[] { "qualified", "qualification", "certificate", "certified", "degree", "license", "licence", "experience" })
    };

    /// <summary>Service-name words that say little on their own.</summary>
    private static readonly HashSet<string> GenericServiceWords = new() { "consultation", "session", "follow", "up", "general", "test" };

    // ---------------------------------------------------------------- reply

    public async Task<ChatAnswer> ReplyAsync(IReadOnlyList<ChatTurn> conversation, CancellationToken cancellationToken)
    {
        var clinic = await _directory.GetAsync(cancellationToken);
        var raw = conversation.LastOrDefault(t => t.Role == "user")?.Content ?? "";
        var msg = Normalize(raw);
        var words = msg.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        // 1. Safety first.
        if (Has(msg, SelfHarm))
            return ChatAnswer.Of(
                "I'm really sorry you're going through this. You don't have to face it alone. " +
                "If you might act on these thoughts or are in danger, please call 112 now or go to the nearest emergency department. " +
                "Talking to someone you trust can help too. When you're ready, our psychiatrists can support you; you can find them on the Doctors page (/doctors).",
                "Show me your psychiatrists");

        if (Has(msg, Emergency))
            return ChatAnswer.Of(
                "If this is an emergency, please call 112 right now or go to the nearest emergency department. " +
                "Don't wait for an online appointment. This chat can't help in an emergency.");

        if (Has(msg, AskHuman))
            return ChatAnswer.Of(
                "I'm an automated assistant, not a person. For anything I can't answer, please ask the reception desk at the clinic. " +
                "I can still help with doctors, prices, booking, payments and how to use this site.",
                "How do I book a visit?", "How do refunds work?");

        // 2. What is the message about?
        var specialties = MatchSpecialties(msg, clinic);
        var doctors = MatchDoctors(words, clinic);
        var (services, exactService) = MatchServices(words, clinic);
        var topics = MatchTopics(msg);

        // Follow-ups such as "how much is it?" or "when do they work?" refer to the previous question.
        if (doctors.Count == 0 && services.Count == 0 && specialties.Count == 0
            && (topics.Contains(Topic.Price) || topics.Contains(Topic.Hours) || topics.Contains(Topic.Booking))
            && words.Length <= 8)
        {
            var previous = conversation.Where(t => t.Role == "user").Reverse().Skip(1).FirstOrDefault();
            if (previous is not null)
            {
                var prevMsg = Normalize(previous.Content);
                var prevWords = prevMsg.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                doctors = MatchDoctors(prevWords, clinic);
                (services, exactService) = MatchServices(prevWords, clinic);
                specialties = MatchSpecialties(prevMsg, clinic);

                // "Who treats thyroid problems?" -> "How much?" is about that specialty's prices, not one service.
                if (specialties.Count > 0 && !exactService) services = new();
                if (specialties.Count > 0 && topics.Contains(Topic.Price)) return SpecialtyPrices(specialties[0], clinic);
            }
        }

        if (Has(msg, MedicalAdvice))
            return MedicalAdviceAnswer(specialties, clinic);

        if (doctors.Count > 0) return DoctorAnswer(doctors, topics);

        // "joint pain" is about a specialist; "joint injection price" or "ECG" is about the service.
        if (services.Count > 0 && (exactService || topics.Contains(Topic.Price) || specialties.Count == 0))
            return ServiceAnswer(services, clinic);

        if (specialties.Count > 0) return SpecialtyAnswer(specialties, clinic, symptomBased: !Has(msg, SpecialtyNames));

        if (topics.Count > 0)
        {
            if (topics.Any(t => !BroadTopics.Contains(t)))
                topics = topics.Where(t => !BroadTopics.Contains(t)).ToList();
            if (topics.Contains(Topic.Hours) && Has(msg, new[] { "saturday", "weekend" }))
                return SaturdayAnswer(clinic);
            if (topics[0] == Topic.Price && Has(msg, new[] { "consultation" }))
                return KindPrices("consultation", "consultations", clinic);

            var answers = topics.Take(2).Select(t => TopicAnswer(t, clinic)).ToList();
            var text = string.Join("\n\n", answers.Select(a => a.Text));
            var suggestions = answers.SelectMany(a => a.Suggestions).Distinct().Take(3).ToArray();
            return new ChatAnswer(text, suggestions);
        }

        // 3. Small talk.
        if (words.Length <= 6)
        {
            if (Has(msg, Thanks)) return ChatAnswer.Of("You're welcome! Is there anything else I can help you with?", "How do I book a visit?");
            if (Has(msg, Bye)) return ChatAnswer.Of("Take care! If you need anything else, I'm here.");
            if (Has(msg, Greeting))
                return ChatAnswer.Of("Hello! How can I help you today?",
                    "How do I book a visit?", "Which doctor should I see for back pain?", "What are your working hours?");
        }

        return Fallback(raw);
    }

    // ---------------------------------------------------------------- answers

    private static ChatAnswer DoctorAnswer(List<DirectoryDoctor> doctors, List<Topic> topics)
    {
        if (doctors.Count > 1)
        {
            var sb = new StringBuilder("We have more than one doctor with that name:\n");
            foreach (var d in doctors.Take(5))
                sb.AppendLine($"- {d.FullName}, {d.Specialization} (/doctors/{d.Id})");
            sb.Append("Which one do you mean? You can write the first name too.");
            return new ChatAnswer(sb.ToString(), doctors.Take(3).Select(d => $"Tell me about {d.FullName}").ToArray());
        }

        var doc = doctors[0];
        var text = new StringBuilder();
        text.AppendLine($"{doc.FullName} is {Article(doc.Specialization)} {Singular(doc.Specialization)} with {doc.Years} years of experience ({RatingText(doc)}).");
        if (!string.IsNullOrWhiteSpace(doc.Bio) && !topics.Contains(Topic.Price) && !topics.Contains(Topic.Hours))
            text.AppendLine(doc.Bio);
        if (doc.Services.Count > 0)
            text.AppendLine("Services: " + string.Join("; ", doc.Services.Select(s => $"{s.Name} {Money(s.Price)} ({s.Minutes} min)")) + ".");
        text.AppendLine($"Working hours: {ClinicDirectory.DescribeHours(doc.Hours)}.");
        text.Append($"See the full profile and book a visit here: (/doctors/{doc.Id})");
        return ChatAnswer.Of(text.ToString(), "How does payment work?", "Can I cancel and get a refund?");
    }

    private static ChatAnswer ServiceAnswer(List<DirectoryService> services, ClinicSnapshot clinic)
    {
        var sb = new StringBuilder();
        if (services.Count == 1)
        {
            var s = services[0];
            sb.AppendLine($"{s.Name} costs {Money(s.Price)} and takes about {s.Minutes} minutes ({s.Department}).");
        }
        else
        {
            sb.AppendLine("Here are the matching services:");
            foreach (var s in services.Take(5))
                sb.AppendLine($"- {s.Name}: {Money(s.Price)}, {s.Minutes} min ({s.Department})");
        }

        var names = services.Take(5).Select(s => s.Name).ToHashSet();
        var offeredBy = clinic.Doctors.Where(d => d.Services.Any(s => names.Contains(s.Name))).Take(4).ToList();
        if (offeredBy.Count > 0)
        {
            sb.AppendLine("Doctors who offer it:");
            foreach (var d in offeredBy)
                sb.AppendLine($"- {d.FullName}, {d.Specialization} (/doctors/{d.Id})");
        }
        sb.Append("If you have valid insurance on file, the insurance share is taken off when you pay.");
        return ChatAnswer.Of(sb.ToString(), "How do I book a visit?", "How does payment work?");
    }

    private static ChatAnswer SpecialtyAnswer(List<string> specialties, ClinicSnapshot clinic, bool symptomBased)
    {
        var sb = new StringBuilder();
        var first = true;
        foreach (var spec in specialties.Take(2))
        {
            var docs = clinic.Doctors.Where(d => d.Specialization == spec).ToList();
            if (!first) sb.AppendLine();
            first = false;

            sb.AppendLine(symptomBased && specialties.Count == 1
                ? $"For that, people usually see {Article(spec)} {Singular(spec)}. Our {Plural(spec)}:"
                : $"Our {Plural(spec)}:");

            if (docs.Count == 0)
            {
                sb.AppendLine("- There is no doctor in this specialization right now.");
                continue;
            }

            foreach (var d in docs)
                sb.AppendLine($"- {d.FullName}, {d.Years} years of experience, {RatingText(d)} (/doctors/{d.Id})");

            var services = docs.SelectMany(d => d.Services).DistinctBy(s => s.Name).ToList();
            if (services.Count > 0)
                sb.AppendLine("Services: " + string.Join("; ", services.Select(s => $"{s.Name} {Money(s.Price)}")) + ".");
        }

        if (symptomBased)
            sb.Append("I can't give medical advice. The doctor will assess what is right for you during the visit.");
        return ChatAnswer.Of(sb.ToString().TrimEnd(), "How do I book a visit?", "How does payment work?");
    }

    private static ChatAnswer MedicalAdviceAnswer(List<string> specialties, ClinicSnapshot clinic)
    {
        const string intro = "I'm sorry, I can't give medical advice, diagnoses or medicine doses. A doctor needs to assess this. " +
                             "If it feels urgent or serious, call 112.";
        if (specialties.Count == 0)
            return ChatAnswer.Of(intro + " Tell me what the problem is about (for example skin, back pain or headaches) and I'll suggest which doctor to see.",
                "Which doctor should I see for headaches?", "How do I book a visit?");

        var spec = SpecialtyAnswer(specialties, clinic, symptomBased: false);
        return new ChatAnswer(intro + "\n\n" + spec.Text, spec.Suggestions);
    }

    private static ChatAnswer TopicAnswer(Topic topic, ClinicSnapshot clinic) => topic switch
    {
        Topic.Booking => ChatAnswer.Of(
            "To book a visit:\n" +
            "1. Log in (/login) or create an account (/register).\n" +
            "2. Find a doctor on the Doctors page (/doctors) and press \"Book a visit\".\n" +
            "3. Choose a service, a day and a free time.\n" +
            "4. Pay by card to confirm. You'll see the visit in My appointments (/appointments).\n" +
            "You can book up to 90 days ahead.",
            "How does payment work?", "Which doctor should I see for back pain?"),

        Topic.Payment => ChatAnswer.Of(
            "Online bookings are paid up front by card when you book. If you have valid insurance on file, the insurance share is taken off and you pay only your part. " +
            "The invoice and receipt appear in My bills (/invoices). If the clinic books a visit for you, you can pay at the desk in cash, by card or by bank transfer.",
            "Can I cancel and get a refund?", "Which insurance do you accept?"),

        Topic.Cancel => ChatAnswer.Of(
            "You can cancel in My appointments (/appointments) up to 2 hours before the visit. If you paid online, the full amount is refunded to your card automatically. " +
            "Less than 2 hours before the visit, please contact the clinic. If the clinic has to cancel (for example the doctor is on leave), you're notified and refunded in full.",
            "How do I reschedule?", "How do I book a visit?"),

        Topic.Reschedule => ChatAnswer.Of(
            "Open My appointments (/appointments), press \"Reschedule\" on the visit and pick a new free time. It works up to 2 hours before the visit, and your payment stays with the visit.",
            "Can I cancel and get a refund?"),

        Topic.Insurance => ChatAnswer.Of(
            (clinic.Insurers.Count > 0 ? $"We accept {JoinNames(clinic.Insurers)}. " : "") +
            "Your policy is added by the reception desk. Once it's on file, your insurance share is taken off automatically when you pay. " +
            "You can see your policies in My health (/health).",
            "How does payment work?"),

        Topic.Hours => HoursAnswer(clinic),

        Topic.Register => ChatAnswer.Of(
            "Create an account on the Register page (/register) with your email, name, personal number, date of birth and a password (at least 8 characters). " +
            "You need to be 18 or older to register online; children are registered by a parent or guardian at the reception desk. " +
            "Then you can book visits and see your records online.",
            "How do I book a visit?"),

        Topic.Login => ChatAnswer.Of(
            "To log in (/login) enter your email, your first and last name exactly as registered, and your password. " +
            "Forgot your password? Reset it here: (/forgot-password).",
            "I forgot my password"),

        Topic.Password => ChatAnswer.Of(
            "Go to Reset password (/forgot-password), enter your email and we'll send you a 6-digit code. Enter the code and choose a new password. " +
            "If you're logged in, you can also change it in My profile (/account).",
            "How do I log in?"),

        Topic.Bills => ChatAnswer.Of(
            "Your invoices, payments and printable receipts are in My bills (/invoices). Visits you book online are paid when you book; refunds show up there too.",
            "Can I cancel and get a refund?"),

        Topic.Records => ChatAnswer.Of(
            "Log in and open My health (/health). There you'll find your medical records written by your doctors, prescriptions, documents (you can upload PDF, PNG or JPG files), allergies and insurance. " +
            "I can't see your records myself.",
            "How do I book a visit?"),

        Topic.Notifications => ChatAnswer.Of(
            "You get an email reminder about 24 hours before each visit. Updates (bookings, changes, cancellations, refunds) also appear under the bell icon (/notifications).",
            "How do I reschedule?"),

        Topic.Reviews => ChatAnswer.Of(
            "After a completed visit you can rate your doctor from 1 to 5 stars and leave a comment in My appointments (/appointments). Ratings are shown on each doctor's profile (/doctors).",
            "Which doctors do you have?"),

        Topic.Profile => ChatAnswer.Of(
            "In My profile (/account) you can upload a profile picture, confirm your email, and change your password or email address.",
            "I forgot my password"),

        Topic.Contact => ChatAnswer.Of(
            "Sorry, I don't have the clinic's address or phone number. Please ask the reception desk. In an emergency, call 112.",
            "What are your working hours?"),

        Topic.Price => PriceOverview(clinic),

        Topic.Doctors or Topic.Specializations => ChatAnswer.Of(
            $"We have {clinic.Doctors.Count} doctors in {clinic.Specializations.Count} specializations: {JoinNames(clinic.Specializations.Select(s => s.Name).ToList())}. " +
            "Browse them on the Doctors page (/doctors). Tell me what you need help with (for example \"skin rash\" or \"knee pain\") and I'll suggest who to see.",
            "Which doctor should I see for headaches?", "Show me your dentists"),

        Topic.Services => PriceOverview(clinic),

        Topic.Credentials => ChatAnswer.Of(
            "Every Umbrella doctor's medical degree and licence are checked by our Credentialing Office. You can see each doctor's experience, education and certificates on their profile (/doctors).",
            "Which doctors do you have?"),

        _ => Fallback("")
    };

    private static ChatAnswer HoursAnswer(ClinicSnapshot clinic)
    {
        var shifts = clinic.Doctors.SelectMany(d => d.Hours).ToList();
        if (shifts.Count == 0)
            return ChatAnswer.Of("Umbrella Medical Center is open 24 hours a day, 7 days a week, including weekends and holidays. Each doctor's visit hours are on their profile (/doctors).");

        string Range(IEnumerable<DirectoryShift> s) =>
            $"{s.Min(x => x.Start):HH\\:mm}-{s.Max(x => x.End):HH\\:mm}";

        var weekdays = shifts.Where(s => s.Day is >= DayOfWeek.Monday and <= DayOfWeek.Friday).ToList();
        var saturday = shifts.Where(s => s.Day == DayOfWeek.Saturday).ToList();
        var sunday = shifts.Where(s => s.Day == DayOfWeek.Sunday).ToList();

        var sb = new StringBuilder("Umbrella Medical Center is open 24 hours a day, 7 days a week, including weekends and holidays. For booked visits, our doctors see patients ");
        sb.Append(weekdays.Count > 0 ? $"Monday to Friday, {Range(weekdays)}" : "on set days");
        if (saturday.Count > 0)
        {
            var count = clinic.Doctors.Count(d => d.Hours.Any(h => h.Day == DayOfWeek.Saturday));
            sb.Append($", and some ({count}) also on Saturday, {Range(saturday)}");
        }
        sb.Append(sunday.Count > 0 ? $", and on Sunday, {Range(sunday)}." : ". On Sundays the clinic is open, but booked doctor visits are not offered yet.");
        sb.Append(" Each doctor has their own hours (many take a lunch break 13:00-14:00), shown on their profile (/doctors), and the booking page only offers free times.");
        return ChatAnswer.Of(sb.ToString(), "How do I book a visit?", "Which doctors work on Saturday?");
    }

    private static ChatAnswer SaturdayAnswer(ClinicSnapshot clinic)
    {
        var docs = clinic.Doctors.Where(d => d.Hours.Any(h => h.Day == DayOfWeek.Saturday)).ToList();
        if (docs.Count == 0)
            return ChatAnswer.Of("The clinic is open 24/7, including weekends, but no doctor offers booked visits on weekends at the moment. See each doctor's hours on their profile (/doctors).");

        var sb = new StringBuilder("These doctors also see patients on Saturday:\n");
        foreach (var d in docs)
        {
            var shifts = d.Hours.Where(h => h.Day == DayOfWeek.Saturday).OrderBy(h => h.Start);
            sb.AppendLine($"- {d.FullName}, {d.Specialization}: {string.Join(", ", shifts.Select(h => $"{h.Start:HH\\:mm}-{h.End:HH\\:mm}"))} (/doctors/{d.Id})");
        }
        sb.Append("The clinic itself is open 24/7, including Sundays.");
        return ChatAnswer.Of(sb.ToString(), "How do I book a visit?");
    }

    private static ChatAnswer SpecialtyPrices(string specialization, ClinicSnapshot clinic)
    {
        var services = clinic.Doctors.Where(d => d.Specialization == specialization)
            .SelectMany(d => d.Services).DistinctBy(s => s.Name).ToList();
        if (services.Count == 0) return PriceOverview(clinic);

        var sb = new StringBuilder($"Prices with our {Plural(specialization)}:\n");
        foreach (var s in services)
            sb.AppendLine($"- {s.Name}: {Money(s.Price)} ({s.Minutes} min)");
        sb.Append("If you have valid insurance on file, the insurance share is taken off when you pay.");
        return ChatAnswer.Of(sb.ToString(), "How do I book a visit?", "How does payment work?");
    }

    /// <summary>All services whose name contains a word, e.g. every "consultation".</summary>
    private static ChatAnswer KindPrices(string word, string plural, ClinicSnapshot clinic)
    {
        var services = clinic.Services.Where(s => s.Name.Contains(word, StringComparison.OrdinalIgnoreCase)).OrderBy(s => s.Price).ToList();
        if (services.Count == 0) return PriceOverview(clinic);

        var sb = new StringBuilder($"Our {plural} cost from {Money(services[0].Price)} to {Money(services[^1].Price)}:\n");
        foreach (var s in services)
            sb.AppendLine($"- {s.Name}: {Money(s.Price)} ({s.Minutes} min)");
        sb.Append("Tell me what the visit is about and I'll suggest the right doctor.");
        return ChatAnswer.Of(sb.ToString(), "Which doctor should I see for back pain?", "How do I book a visit?");
    }

    private static ChatAnswer PriceOverview(ClinicSnapshot clinic)
    {
        var examples = clinic.Services.GroupBy(s => s.Department).Select(g => g.OrderBy(s => s.Price).First()).Take(8).ToList();
        var sb = new StringBuilder("Prices depend on the service. Some examples:\n");
        foreach (var s in examples)
            sb.AppendLine($"- {s.Name}: {Money(s.Price)} ({s.Minutes} min)");
        sb.Append("Every doctor's prices are on their profile (/doctors). Which service are you interested in?");
        return ChatAnswer.Of(sb.ToString(), "How much is an eye examination?", "How does payment work?");
    }

    private static ChatAnswer Fallback(string raw)
    {
        var note = ContainsNonLatin(raw) ? "I can only understand English well for now. " : "";
        return ChatAnswer.Of(
            note + "Sorry, I didn't quite understand that. I can help with our doctors and which one to see, prices, booking, payment and refunds, insurance, working hours and using the website. " +
            "For anything else, please ask the reception desk.",
            "How do I book a visit?", "Which doctor should I see for back pain?", "How much is a consultation?", "What are your working hours?");
    }

    // ---------------------------------------------------------------- matching

    private static List<string> MatchSpecialties(string msg, ClinicSnapshot clinic)
    {
        var known = clinic.Specializations.Select(s => s.Name).ToHashSet();
        return SpecialtyWords
            .Where(kv => known.Contains(kv.Key))
            .Select(kv => (Name: kv.Key, Hits: kv.Value.Count(w => HasWord(msg, w))))
            .Where(x => x.Hits > 0)
            .OrderByDescending(x => x.Hits)
            .Select(x => x.Name)
            .ToList();
    }

    /// <summary>Words that name a specialty itself ("dentist"), as opposed to describing a problem ("toothache").</summary>
    private static readonly string[] SpecialtyNames =
    {
        "dentist", "dermat", "cardiolog", "pediatric", "paediatric", "neurolog", "orthop", "ophthalm", "gyneco", "gynaeco",
        "psychiat", "endocrin", "urolog", "radiolog", "ent ", "gp ", "general practitioner", "family doctor", "otolaryng"
    };

    private static List<DirectoryDoctor> MatchDoctors(string[] words, ClinicSnapshot clinic)
    {
        var wordSet = words.ToHashSet();
        var byLast = clinic.Doctors.Where(d => wordSet.Contains(d.LastName.ToLowerInvariant())).ToList();
        if (byLast.Count <= 1) return byLast;

        var byBoth = byLast.Where(d => wordSet.Contains(d.FirstName.ToLowerInvariant())).ToList();
        return byBoth.Count > 0 ? byBoth : byLast;
    }

    /// <summary>Services named in the message, best matches first; Exact is true when every word of a service name was used.</summary>
    private static (List<DirectoryService> Services, bool Exact) MatchServices(string[] words, ClinicSnapshot clinic)
    {
        var scored = new List<(DirectoryService Service, int Specific, double Ratio)>();
        foreach (var service in clinic.Services)
        {
            var tokens = Normalize(service.Name).Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(t => t.Length >= 3).ToList();
            if (tokens.Count == 0) continue;

            var matched = tokens.Where(t => words.Any(w => WordMatches(w, t))).ToList();
            var specific = matched.Count(t => !GenericServiceWords.Contains(t));
            var allMatched = matched.Count == tokens.Count;

            if (specific > 0 || allMatched)
                scored.Add((service, specific + (allMatched ? 1 : 0), (double)matched.Count / tokens.Count));
        }

        if (scored.Count == 0) return (new(), false);
        var best = scored.Max(s => s.Specific);
        var top = scored.Where(s => s.Specific == best).OrderByDescending(s => s.Ratio).Take(5).ToList();
        return (top.Select(s => s.Service).ToList(), top[0].Ratio >= 1.0);
    }

    private static List<Topic> MatchTopics(string msg) =>
        TopicWords
            .Select(t => (t.Topic, Hits: t.Words.Count(w => HasWord(msg, w))))
            .Where(t => t.Hits > 0)
            .OrderByDescending(t => t.Hits)
            .ThenBy(t => (int)t.Topic)
            .Select(t => t.Topic)
            .ToList();

    /// <summary>"exam" matches "examination", "teeth" matches "teeth", but "ear" does not match "year".</summary>
    private static bool WordMatches(string word, string token)
    {
        if (word.Length < 3) return false;
        var stem = token[..Math.Min(token.Length, 5)];
        return word.StartsWith(stem, StringComparison.Ordinal) || (word.Length >= 4 && token.StartsWith(word, StringComparison.Ordinal));
    }

    private static bool Has(string msg, IEnumerable<string> phrases) => phrases.Any(p => HasWord(msg, p));

    /// <summary>The phrase appears at the start of a word ("dizz" matches "dizzy"; "ear" does not match "hear").</summary>
    private static bool HasWord(string msg, string phrase) => msg.Contains(" " + phrase, StringComparison.Ordinal);

    /// <summary>Lower-case, letters and digits only, single spaces, with a leading space for word matching.</summary>
    private static string Normalize(string text)
    {
        var lower = text.ToLowerInvariant().Replace("x-ray", "xray").Replace("x ray", "xray").Replace("’", "'");
        var sb = new StringBuilder(" ");
        foreach (var ch in lower)
            sb.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
        return " " + MultiSpace().Replace(sb.ToString(), " ").Trim() + " ";
    }

    [GeneratedRegex(" {2,}")]
    private static partial Regex MultiSpace();

    private static bool ContainsNonLatin(string text) =>
        text.Any(ch => ch is >= 'Ⴀ' and <= 'ჿ' or >= 'Ѐ' and <= 'ӿ');

    private static string Money(decimal amount) => $"{amount.ToString("0.##", C)} GEL";

    private static string RatingText(DirectoryDoctor d) =>
        d.Reviews > 0 ? $"rated {d.Rating.ToString("0.0", C)}/5 by {d.Reviews} patient{(d.Reviews == 1 ? "" : "s")}" : "no reviews yet";

    private static string Singular(string specialization) => specialization switch
    {
        "Otolaryngologist (ENT)" => "ENT specialist",
        _ => specialization.ToLowerInvariant()
    };

    private static string Plural(string specialization) => Singular(specialization) + "s";

    private static string Article(string specialization) =>
        "aeiou".Contains(char.ToLowerInvariant(Singular(specialization)[0])) ? "an" : "a";

    private static string JoinNames(IReadOnlyList<string> names) =>
        names.Count <= 1 ? string.Join("", names) : string.Join(", ", names.Take(names.Count - 1)) + " and " + names[^1];
}

IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Allergies] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Allergies] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Departments] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Departments] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Diagnoses] (
        [Id] int NOT NULL IDENTITY,
        [Code] nvarchar(450) NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Diagnoses] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [InsuranceCompanies] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        [Phone] nvarchar(max) NULL,
        [Email] nvarchar(max) NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_InsuranceCompanies] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Medications] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        [GenericName] nvarchar(max) NULL,
        [Form] nvarchar(max) NULL,
        [Strength] nvarchar(max) NULL,
        [Manufacturer] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Medications] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Roles] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(450) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Roles] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Specializations] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Specializations] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Rooms] (
        [Id] int NOT NULL IDENTITY,
        [Number] nvarchar(max) NOT NULL,
        [Floor] int NOT NULL,
        [Type] int NOT NULL,
        [IsActive] bit NOT NULL,
        [DepartmentId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Rooms] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Rooms_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [Departments] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Services] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [Price] decimal(18,2) NOT NULL,
        [DurationMinutes] int NOT NULL,
        [IsActive] bit NOT NULL,
        [DepartmentId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Services] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Services_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [Departments] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Users] (
        [Id] int NOT NULL IDENTITY,
        [Email] nvarchar(450) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [IsActive] bit NOT NULL,
        [RoleId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Users_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] int NOT NULL IDENTITY,
        [Action] nvarchar(max) NOT NULL,
        [EntityName] nvarchar(max) NOT NULL,
        [EntityId] int NULL,
        [Details] nvarchar(max) NULL,
        [IpAddress] nvarchar(max) NULL,
        [UserId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AuditLogs_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Doctors] (
        [Id] int NOT NULL IDENTITY,
        [FirstName] nvarchar(max) NOT NULL,
        [LastName] nvarchar(max) NOT NULL,
        [LicenseNumber] nvarchar(450) NOT NULL,
        [Phone] nvarchar(max) NULL,
        [Email] nvarchar(max) NULL,
        [Bio] nvarchar(max) NULL,
        [PhotoUrl] nvarchar(max) NULL,
        [YearsOfExperience] int NOT NULL,
        [AverageRating] decimal(18,2) NOT NULL,
        [ReviewCount] int NOT NULL,
        [SpecializationId] int NOT NULL,
        [UserId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Doctors] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Doctors_Specializations_SpecializationId] FOREIGN KEY ([SpecializationId]) REFERENCES [Specializations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Doctors_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Patients] (
        [Id] int NOT NULL IDENTITY,
        [FirstName] nvarchar(max) NOT NULL,
        [LastName] nvarchar(max) NOT NULL,
        [PersonalNumber] nvarchar(450) NOT NULL,
        [DateOfBirth] date NOT NULL,
        [Gender] int NOT NULL,
        [Phone] nvarchar(max) NULL,
        [Email] nvarchar(max) NULL,
        [Address] nvarchar(max) NULL,
        [MedicalHistory] nvarchar(max) NULL,
        [UserId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Patients] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Patients_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Receptionists] (
        [Id] int NOT NULL IDENTITY,
        [FirstName] nvarchar(max) NOT NULL,
        [LastName] nvarchar(max) NOT NULL,
        [Phone] nvarchar(max) NULL,
        [UserId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Receptionists] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Receptionists_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [DoctorEducations] (
        [Id] int NOT NULL IDENTITY,
        [Institution] nvarchar(max) NOT NULL,
        [Degree] nvarchar(max) NOT NULL,
        [StartYear] int NOT NULL,
        [GraduationYear] int NOT NULL,
        [DiplomaFileUrl] nvarchar(max) NULL,
        [DoctorId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_DoctorEducations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DoctorEducations_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [DoctorExperiences] (
        [Id] int NOT NULL IDENTITY,
        [Workplace] nvarchar(max) NOT NULL,
        [Position] nvarchar(max) NOT NULL,
        [StartDate] date NOT NULL,
        [EndDate] date NULL,
        [Description] nvarchar(max) NULL,
        [DoctorId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_DoctorExperiences] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DoctorExperiences_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [DoctorSchedules] (
        [Id] int NOT NULL IDENTITY,
        [DayOfWeek] int NOT NULL,
        [StartTime] time NOT NULL,
        [EndTime] time NOT NULL,
        [IsActive] bit NOT NULL,
        [DoctorId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_DoctorSchedules] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DoctorSchedules_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [DoctorServices] (
        [Id] int NOT NULL IDENTITY,
        [DoctorId] int NOT NULL,
        [ServiceId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_DoctorServices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DoctorServices_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_DoctorServices_Services_ServiceId] FOREIGN KEY ([ServiceId]) REFERENCES [Services] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [TimeOffs] (
        [Id] int NOT NULL IDENTITY,
        [StartDateTime] datetime2 NOT NULL,
        [EndDateTime] datetime2 NOT NULL,
        [Reason] nvarchar(max) NULL,
        [DoctorId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TimeOffs] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TimeOffs_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Appointments] (
        [Id] int NOT NULL IDENTITY,
        [StartDateTime] datetime2 NOT NULL,
        [EndDateTime] datetime2 NOT NULL,
        [Status] int NOT NULL,
        [Reason] nvarchar(max) NULL,
        [Notes] nvarchar(max) NULL,
        [CancellationReason] nvarchar(max) NULL,
        [ReminderSent] bit NOT NULL,
        [PatientId] int NOT NULL,
        [DoctorId] int NOT NULL,
        [ServiceId] int NOT NULL,
        [RoomId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Appointments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Appointments_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Appointments_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Appointments_Rooms_RoomId] FOREIGN KEY ([RoomId]) REFERENCES [Rooms] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Appointments_Services_ServiceId] FOREIGN KEY ([ServiceId]) REFERENCES [Services] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [PatientAllergies] (
        [Id] int NOT NULL IDENTITY,
        [Severity] int NOT NULL,
        [Notes] nvarchar(max) NULL,
        [PatientId] int NOT NULL,
        [AllergyId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PatientAllergies] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PatientAllergies_Allergies_AllergyId] FOREIGN KEY ([AllergyId]) REFERENCES [Allergies] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PatientAllergies_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [PatientInsurances] (
        [Id] int NOT NULL IDENTITY,
        [PolicyNumber] nvarchar(max) NOT NULL,
        [CoveragePercent] decimal(18,2) NOT NULL,
        [ValidFrom] date NOT NULL,
        [ValidTo] date NOT NULL,
        [PatientId] int NOT NULL,
        [InsuranceCompanyId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PatientInsurances] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PatientInsurances_InsuranceCompanies_InsuranceCompanyId] FOREIGN KEY ([InsuranceCompanyId]) REFERENCES [InsuranceCompanies] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PatientInsurances_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [DoctorReviews] (
        [Id] int NOT NULL IDENTITY,
        [Rating] int NOT NULL,
        [Comment] nvarchar(max) NULL,
        [IsApproved] bit NOT NULL,
        [DoctorId] int NOT NULL,
        [PatientId] int NOT NULL,
        [AppointmentId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_DoctorReviews] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DoctorReviews_Appointments_AppointmentId] FOREIGN KEY ([AppointmentId]) REFERENCES [Appointments] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_DoctorReviews_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_DoctorReviews_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [MedicalRecords] (
        [Id] int NOT NULL IDENTITY,
        [RecordDate] datetime2 NOT NULL,
        [Complaints] nvarchar(max) NULL,
        [DiagnosisDetails] nvarchar(max) NULL,
        [Treatment] nvarchar(max) NULL,
        [Recommendations] nvarchar(max) NULL,
        [Notes] nvarchar(max) NULL,
        [PatientId] int NOT NULL,
        [DoctorId] int NOT NULL,
        [AppointmentId] int NULL,
        [DiagnosisId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MedicalRecords] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MedicalRecords_Appointments_AppointmentId] FOREIGN KEY ([AppointmentId]) REFERENCES [Appointments] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MedicalRecords_Diagnoses_DiagnosisId] FOREIGN KEY ([DiagnosisId]) REFERENCES [Diagnoses] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MedicalRecords_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MedicalRecords_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Notifications] (
        [Id] int NOT NULL IDENTITY,
        [Title] nvarchar(max) NOT NULL,
        [Message] nvarchar(max) NOT NULL,
        [Channel] int NOT NULL,
        [Status] int NOT NULL,
        [SentAt] datetime2 NULL,
        [IsRead] bit NOT NULL,
        [UserId] int NOT NULL,
        [AppointmentId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Notifications_Appointments_AppointmentId] FOREIGN KEY ([AppointmentId]) REFERENCES [Appointments] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Notifications_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Invoices] (
        [Id] int NOT NULL IDENTITY,
        [InvoiceNumber] nvarchar(450) NOT NULL,
        [IssueDate] datetime2 NOT NULL,
        [DueDate] datetime2 NULL,
        [Status] int NOT NULL,
        [Subtotal] decimal(18,2) NOT NULL,
        [InsuranceCoverage] decimal(18,2) NOT NULL,
        [TotalAmount] decimal(18,2) NOT NULL,
        [PatientId] int NOT NULL,
        [AppointmentId] int NULL,
        [PatientInsuranceId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Invoices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Invoices_Appointments_AppointmentId] FOREIGN KEY ([AppointmentId]) REFERENCES [Appointments] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Invoices_PatientInsurances_PatientInsuranceId] FOREIGN KEY ([PatientInsuranceId]) REFERENCES [PatientInsurances] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Invoices_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [MedicalDocuments] (
        [Id] int NOT NULL IDENTITY,
        [Type] int NOT NULL,
        [FileName] nvarchar(max) NOT NULL,
        [FileUrl] nvarchar(max) NOT NULL,
        [ContentType] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [PatientId] int NOT NULL,
        [MedicalRecordId] int NULL,
        [UploadedByUserId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MedicalDocuments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MedicalDocuments_MedicalRecords_MedicalRecordId] FOREIGN KEY ([MedicalRecordId]) REFERENCES [MedicalRecords] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MedicalDocuments_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MedicalDocuments_Users_UploadedByUserId] FOREIGN KEY ([UploadedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Prescriptions] (
        [Id] int NOT NULL IDENTITY,
        [IssuedDate] datetime2 NOT NULL,
        [ExpiryDate] datetime2 NOT NULL,
        [Instructions] nvarchar(max) NULL,
        [PatientId] int NOT NULL,
        [DoctorId] int NOT NULL,
        [MedicalRecordId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Prescriptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Prescriptions_Doctors_DoctorId] FOREIGN KEY ([DoctorId]) REFERENCES [Doctors] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Prescriptions_MedicalRecords_MedicalRecordId] FOREIGN KEY ([MedicalRecordId]) REFERENCES [MedicalRecords] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Prescriptions_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [ToothRecords] (
        [Id] int NOT NULL IDENTITY,
        [ToothNumber] int NOT NULL,
        [Condition] int NOT NULL,
        [Treatment] nvarchar(max) NULL,
        [Notes] nvarchar(max) NULL,
        [PatientId] int NOT NULL,
        [MedicalRecordId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ToothRecords] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ToothRecords_MedicalRecords_MedicalRecordId] FOREIGN KEY ([MedicalRecordId]) REFERENCES [MedicalRecords] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ToothRecords_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [VitalSigns] (
        [Id] int NOT NULL IDENTITY,
        [HeightCm] decimal(18,2) NULL,
        [WeightKg] decimal(18,2) NULL,
        [SystolicBp] int NULL,
        [DiastolicBp] int NULL,
        [HeartRate] int NULL,
        [TemperatureC] decimal(18,2) NULL,
        [RecordedAt] datetime2 NOT NULL,
        [PatientId] int NOT NULL,
        [MedicalRecordId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_VitalSigns] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_VitalSigns_MedicalRecords_MedicalRecordId] FOREIGN KEY ([MedicalRecordId]) REFERENCES [MedicalRecords] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_VitalSigns_Patients_PatientId] FOREIGN KEY ([PatientId]) REFERENCES [Patients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [InvoiceItems] (
        [Id] int NOT NULL IDENTITY,
        [Description] nvarchar(max) NOT NULL,
        [Quantity] int NOT NULL,
        [UnitPrice] decimal(18,2) NOT NULL,
        [LineTotal] decimal(18,2) NOT NULL,
        [InvoiceId] int NOT NULL,
        [ServiceId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_InvoiceItems] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InvoiceItems_Invoices_InvoiceId] FOREIGN KEY ([InvoiceId]) REFERENCES [Invoices] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_InvoiceItems_Services_ServiceId] FOREIGN KEY ([ServiceId]) REFERENCES [Services] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [Payments] (
        [Id] int NOT NULL IDENTITY,
        [Amount] decimal(18,2) NOT NULL,
        [Method] int NOT NULL,
        [Status] int NOT NULL,
        [PaidAt] datetime2 NULL,
        [TransactionReference] nvarchar(max) NULL,
        [InvoiceId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Payments_Invoices_InvoiceId] FOREIGN KEY ([InvoiceId]) REFERENCES [Invoices] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE TABLE [PrescriptionItems] (
        [Id] int NOT NULL IDENTITY,
        [Dosage] nvarchar(max) NOT NULL,
        [Frequency] nvarchar(max) NOT NULL,
        [DurationDays] int NOT NULL,
        [PrescriptionId] int NOT NULL,
        [MedicationId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PrescriptionItems] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PrescriptionItems_Medications_MedicationId] FOREIGN KEY ([MedicationId]) REFERENCES [Medications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PrescriptionItems_Prescriptions_PrescriptionId] FOREIGN KEY ([PrescriptionId]) REFERENCES [Prescriptions] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Appointments_DoctorId] ON [Appointments] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Appointments_PatientId] ON [Appointments] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Appointments_RoomId] ON [Appointments] ([RoomId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Appointments_ServiceId] ON [Appointments] ([ServiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_UserId] ON [AuditLogs] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Diagnoses_Code] ON [Diagnoses] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_DoctorEducations_DoctorId] ON [DoctorEducations] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_DoctorExperiences_DoctorId] ON [DoctorExperiences] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_DoctorReviews_AppointmentId] ON [DoctorReviews] ([AppointmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_DoctorReviews_DoctorId] ON [DoctorReviews] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_DoctorReviews_PatientId] ON [DoctorReviews] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Doctors_LicenseNumber] ON [Doctors] ([LicenseNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Doctors_SpecializationId] ON [Doctors] ([SpecializationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Doctors_UserId] ON [Doctors] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_DoctorSchedules_DoctorId] ON [DoctorSchedules] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_DoctorServices_DoctorId_ServiceId] ON [DoctorServices] ([DoctorId], [ServiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_DoctorServices_ServiceId] ON [DoctorServices] ([ServiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_InvoiceItems_InvoiceId] ON [InvoiceItems] ([InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_InvoiceItems_ServiceId] ON [InvoiceItems] ([ServiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Invoices_AppointmentId] ON [Invoices] ([AppointmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Invoices_InvoiceNumber] ON [Invoices] ([InvoiceNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Invoices_PatientId] ON [Invoices] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Invoices_PatientInsuranceId] ON [Invoices] ([PatientInsuranceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalDocuments_MedicalRecordId] ON [MedicalDocuments] ([MedicalRecordId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalDocuments_PatientId] ON [MedicalDocuments] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalDocuments_UploadedByUserId] ON [MedicalDocuments] ([UploadedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalRecords_AppointmentId] ON [MedicalRecords] ([AppointmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalRecords_DiagnosisId] ON [MedicalRecords] ([DiagnosisId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalRecords_DoctorId] ON [MedicalRecords] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_MedicalRecords_PatientId] ON [MedicalRecords] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Notifications_AppointmentId] ON [Notifications] ([AppointmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Notifications_UserId] ON [Notifications] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PatientAllergies_AllergyId] ON [PatientAllergies] ([AllergyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PatientAllergies_PatientId_AllergyId] ON [PatientAllergies] ([PatientId], [AllergyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PatientInsurances_InsuranceCompanyId] ON [PatientInsurances] ([InsuranceCompanyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PatientInsurances_PatientId] ON [PatientInsurances] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Patients_PersonalNumber] ON [Patients] ([PersonalNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Patients_UserId] ON [Patients] ([UserId]) WHERE [UserId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Payments_InvoiceId] ON [Payments] ([InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PrescriptionItems_MedicationId] ON [PrescriptionItems] ([MedicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PrescriptionItems_PrescriptionId] ON [PrescriptionItems] ([PrescriptionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Prescriptions_DoctorId] ON [Prescriptions] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Prescriptions_MedicalRecordId] ON [Prescriptions] ([MedicalRecordId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Prescriptions_PatientId] ON [Prescriptions] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Receptionists_UserId] ON [Receptionists] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Roles_Name] ON [Roles] ([Name]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Rooms_DepartmentId] ON [Rooms] ([DepartmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Services_DepartmentId] ON [Services] ([DepartmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TimeOffs_DoctorId] ON [TimeOffs] ([DoctorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ToothRecords_MedicalRecordId] ON [ToothRecords] ([MedicalRecordId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ToothRecords_PatientId] ON [ToothRecords] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Users_RoleId] ON [Users] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_VitalSigns_MedicalRecordId] ON [VitalSigns] ([MedicalRecordId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_VitalSigns_PatientId] ON [VitalSigns] ([PatientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261021183207_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261021183207_InitialCreate', N'10.0.15');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    ALTER TABLE [TimeOffs] ADD [DeclineReason] nvarchar(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    ALTER TABLE [TimeOffs] ADD [ReviewedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    ALTER TABLE [TimeOffs] ADD [ReviewedByUserId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    ALTER TABLE [TimeOffs] ADD [Status] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    ALTER TABLE [TimeOffs] ADD [Type] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    CREATE INDEX [IX_TimeOffs_ReviewedByUserId] ON [TimeOffs] ([ReviewedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    ALTER TABLE [TimeOffs] ADD CONSTRAINT [FK_TimeOffs_Users_ReviewedByUserId] FOREIGN KEY ([ReviewedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031103925_TimeOffApproval'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261031103925_TimeOffApproval', N'10.0.15');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031110231_EmailVerification'
)
BEGIN
    ALTER TABLE [Users] ADD [EmailConfirmed] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031110231_EmailVerification'
)
BEGIN
    CREATE TABLE [UserTokens] (
        [Id] int NOT NULL IDENTITY,
        [Purpose] int NOT NULL,
        [TokenHash] nvarchar(128) NOT NULL,
        [ExpiresAt] datetime2 NOT NULL,
        [UsedAt] datetime2 NULL,
        [FailedAttempts] int NOT NULL,
        [NewEmail] nvarchar(256) NULL,
        [UserId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_UserTokens] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UserTokens_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031110231_EmailVerification'
)
BEGIN
    CREATE INDEX [IX_UserTokens_UserId_Purpose] ON [UserTokens] ([UserId], [Purpose]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031110231_EmailVerification'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261031110231_EmailVerification', N'10.0.15');
END;

COMMIT;
GO


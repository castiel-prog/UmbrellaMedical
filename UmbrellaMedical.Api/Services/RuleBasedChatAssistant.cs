using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// The built-in help assistant: no AI and no API key. It recognises common questions by keywords (in all seven site
/// languages) and answers from the live clinic directory (doctors, services, prices, hours) and fixed policy texts,
/// in the language the visitor is using on the site. It never gives medical advice; symptoms are only mapped to the
/// kind of specialist that usually helps.
/// </summary>
public partial class RuleBasedChatAssistant : IChatAssistant
{
    private static readonly CultureInfo C = CultureInfo.InvariantCulture;
    private readonly IClinicDirectory _directory;
    private readonly IClinicText _text;

    public RuleBasedChatAssistant(IClinicDirectory directory, IClinicText text)
    {
        _directory = directory;
        _text = text;
    }

    public string Mode => "faq";
    public bool IsConfigured => true;

    // ---------------------------------------------------------------- keywords (en, ka, de, fr, it, es, ru)

    private static readonly string[] Emergency =
    {
        "chest pain", "pain in my chest", "cant breathe", "can t breathe", "cannot breathe", "trouble breathing",
        "difficulty breathing", "not breathing", "stroke", "unconscious", "fainted", "passed out", "severe bleeding",
        "bleeding a lot", "heavy bleeding", "heart attack", "overdose", "poisoned", "poisoning", "choking",
        "emergency", "ambulance", "სასწრაფო", "გულის შეტევ", "სუნთქვა მიჭირ", "notfall", "notarzt", "brustschmerz", "urgence",
        "douleur thoracique", "emergenza", "dolore al petto", "urgencia", "dolor de pecho", "скорая", "боль в груди", "не могу дышать"
    };

    private static readonly string[] SelfHarm =
    {
        "kill myself", "suicide", "suicidal", "end my life", "hurt myself", "self harm", "want to die", "don t want to live",
        "dont want to live", "თავის მოკვლ", "სუიციდ", "selbstmord", "suizid", "me suicider", "suicid", "suicidio", "suicidarme",
        "покончить с собой", "суицид", "не хочу жить"
    };

    private static readonly string[] AskHuman =
    {
        "are you human", "are you a human", "are you a bot", "are you real", "real person", "talk to a human", "talk to someone",
        "speak to someone", "speak to a person", "live agent", "live chat", "operator", "talk to a person", "are you ai", "are you an ai",
        "ადამიანი ხარ", "რობოტი ხარ", "bist du ein mensch", "bist du ein bot", "êtes vous humain", "es tu humain", "sei umano",
        "sei un bot", "eres humano", "eres un bot", "ты человек", "ты бот", "оператор"
    };

    private static readonly string[] MedicalAdvice =
    {
        "what medicine", "which medicine", "what medication", "which medication", "what pill", "which pill", "dosage", "dose",
        "how much should i take", "should i take", "diagnose", "diagnosis", "is it serious", "what do i have", "what s wrong with me",
        "is it cancer", "antibiotic", "treat it at home", "home remedy", "cure", "რა წამალი", "დოზა", "welches medikament", "dosierung",
        "quel médicament", "posologie", "quale medicina", "dosaggio", "qué medicamento", "dosis", "какое лекарство", "дозировк"
    };

    // A trailing space means "whole word only" (the normalized message always ends with a space).
    private static readonly string[] Greeting = { "hi ", "hello", "hey ", "good morning", "good afternoon", "good evening", "გამარჯობა", "სალამი", "hallo", "guten tag", "bonjour", "salut", "ciao", "buongiorno", "hola", "buenos días", "привет", "здравствуйте" };
    private static readonly string[] Thanks = { "thank", "thanks", "thx", "appreciate", "მადლობ", "danke", "merci", "grazie", "gracias", "спасибо" };
    private static readonly string[] Bye = { "bye", "goodbye", "see you", "ნახვამდის", "tschüss", "auf wiedersehen", "au revoir", "arrivederci", "adiós", "пока", "до свидания" };

    /// <summary>Everyday words for each specialization (matched at the start of a word).</summary>
    private static readonly Dictionary<string, string[]> SpecialtyWords = new()
    {
        ["Gastroenterologist"] = new[] { "stomach", "heartburn", "reflux", "bloat", "constipat", "diarrh", "bowel", "liver", "nausea", "gastro", "კუჭ", "გულძმარვ", "ნაწლავ", "ღვიძლ", "გასტროენტეროლოგ", "magen", "sodbrennen", "darm", "estomac", "brûlures", "stomaco", "bruciore", "estómago", "acidez", "желуд", "изжог", "кишеч", "гастроэнтеролог" },
        ["Pulmonologist"] = new[] { "lung", "breath", "short of breath", "wheez", "copd", "pneumon", "pulmon", "ფილტვ", "სუნთქვ", "ქოშინ", "პულმონოლოგ", "lunge", "atem", "poumon", "respir", "polmon", "pulmón", "respirar", "лёгк", "легк", "одышк", "дыхан", "пульмонолог" },
        ["Allergist"] = new[] { "allerg", "hay fever", "pollen", "sneez", "hives", "food allerg", "ალერგ", "ალერგოლოგ", "pollen", "heuschnupfen", "allergi", "alergi", "аллерг" },
        ["Rheumatologist"] = new[] { "arthritis", "rheumat", "gout", "lupus", "stiff joint", "joint swelling", "swollen joint", "ართრიტ", "რევმატ", "სახსრების ანთებ", "arthrit", "rhumat", "reumat", "артрит", "ревмат", "подагр" },
        ["Physiotherapist"] = new[] { "physio", "rehab", "posture", "neck pain", "after surgery", "exercise therapy", "ფიზიოთერაპ", "რეაბილიტ", "კისრის ტკივ", "physiotherap", "kinési", "fisioterap", "rehabilit", "физиотерап", "реабилит", "лфк" },
        ["Nutritionist"] = new[] { "diet", "nutrition", "weight loss", "lose weight", "overweight", "obes", "meal plan", "healthy eating", "დიეტ", "წონის დაკლ", "ჭარბი წონ", "კვებ", "ნუტრიციოლოგ", "ernährung", "abnehmen", "régime", "nutrition", "dieta", "nutrizion", "nutrición", "диет", "похуд", "питани", "нутрициолог" },
        ["Dermatologist"] = new[] { "skin", "rash", "acne", "pimple", "eczema", "mole", "itch", "hair loss", "nail", "psoriasis", "dermat", "კან", "გამონაყარ", "haut", "ausschlag", "peau", "pelle", "piel", "кож", "сыпь" },
        ["Dentist"] = new[] { "tooth", "teeth", "dental", "dentist", "gum ", "gums ", "cavity", "toothache", "filling", "braces", "კბილ", "სტომატოლოგ", "stomatolog", "zahn", "zähne", "dent", "dente", "denti", "diente", "muela", "зуб", "стоматолог" },
        ["Cardiologist"] = new[] { "heart", "blood pressure", "hypertension", "palpitation", "cardio", "cholesterol", "ecg ", "გულ", "წნევ", "herz", "blutdruck", "kardio", "cœur", "coeur", "tension", "cuore", "pressione", "corazón", "presión", "сердц", "давлени", "кардиолог" },
        ["Pediatrician"] = new[] { "child", "children", "kid ", "kids ", "baby", "babies", "infant", "toddler", "pediatric", "paediatric", "my son", "my daughter", "ბავშვ", "პედიატრ", "kind", "kinder", "enfant", "bébé", "pédiatr", "bambin", "pediatr", "niño", "niña", "hijo", "hija", "ребен", "ребён", "дет", "педиатр" },
        ["General Practitioner"] = new[] { "general practitioner", "family doctor", "gp ", "checkup", "check up", "fever", "cold ", "flu ", "cough", "tired", "fatigue", "თერაპევტ", "ოჯახის ექიმ", "სიცხე", "ხველ", "hausarzt", "fieber", "husten", "médecin généraliste", "fièvre", "toux", "medico di base", "febbre", "tosse", "médico de cabecera", "fiebre", "tos ", "терапевт", "температур", "кашель" },
        ["Radiologist"] = new[] { "xray", "radiolog", "imaging", "scan ", "scans ", "ultrasound", "რენტგენ", "ექოსკოპ", "röntgen", "ultraschall", "radio", "échographie", "ecografia", "radiografía", "ecografía", "рентген", "узи" },
        ["Neurologist"] = new[] { "headache", "migraine", "dizz", "numb ", "numbness", "tingling", "epilep", "nerve", "neurolog", "memory problem", "თავის ტკივ", "შაკიკ", "ნევროლოგ", "kopfschmerz", "migräne", "schwindel", "mal de tête", "migraine", "vertige", "mal di testa", "emicrania", "dolor de cabeza", "migraña", "mareo", "головн", "мигрен", "невролог" },
        ["Orthopedist"] = new[] { "knee", "back pain", "my back", "joint", "bone", "fracture", "broken", "shoulder", "sprain", "sport injur", "sports injur", "hip ", "hips ", "ankle", "ortho", "მუხლ", "ზურგ", "სახსარ", "ორთოპედ", "knie", "rücken", "gelenk", "genou", "dos ", "articulation", "ginocchio", "schiena", "articolazion", "rodilla", "espalda", "articulación", "колен", "спин", "сустав", "ортопед" },
        ["Ophthalmologist"] = new[] { "eye", "vision", "glasses", "sight", "blurry", "ophthalm", "თვალ", "მხედველობ", "auge", "augen", "sehen", "œil", "yeux", "vue ", "occhi", "occhio", "vista", "ojo", "ojos", "глаз", "зрени", "офтальмолог" },
        ["Otolaryngologist (ENT)"] = new[] { "ear ", "ears ", "earache", "nose", "throat", "sinus", "hearing", "tonsil", "ent ", "snoring", "ყურ", "ცხვირ", "ყელ", "ohr", "nase", "hals", "oreille", "nez", "gorge", "orecchi", "naso", "gola", "oído", "nariz", "garganta", "ухо", "уши", "нос", "горл", "лор" },
        ["Gynecologist"] = new[] { "pregnan", "gyneco", "gynaeco", "period", "menstru", "women s health", "womens health", "contracept", "გინეკოლოგ", "ორსულ", "schwanger", "frauenarzt", "gynäkolog", "enceinte", "grossesse", "gynécolog", "incinta", "gravidanza", "ginecolog", "embaraz", "беремен", "гинеколог" },
        ["Psychiatrist"] = new[] { "anxiety", "anxious", "depress", "stress", "panic", "mental", "insomnia", "can t sleep", "cant sleep", "burnout", "psychiat", "psichiatr", "psiquiatr", "therapy", "ფსიქიატრ", "შფოთვ", "დეპრესი", "სტრეს", "angst", "schlaflos", "anxiété", "dépress", "ansia", "depressione", "ansiedad", "depresión", "тревог", "депресс", "стресс", "бессонниц", "психиатр" },
        ["Endocrinologist"] = new[] { "diabet", "thyroid", "hormon", "blood sugar", "endocrin", "metabol", "დიაბეტ", "ფარისებრ", "ენდოკრინოლოგ", "schilddrüse", "thyroïde", "tiroide", "tiroides", "диабет", "щитовид", "эндокринолог" },
        ["Urologist"] = new[] { "kidney", "bladder", "urin", "prostate", "urolog", "თირკმელ", "უროლოგ", "niere", "blase", "rein", "vessie", "rene", "vescica", "riñón", "vejiga", "почк", "мочев", "уролог" }
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
        (Topic.Booking, new[] { "book", "booking", "appointment", "make an appointment", "reserve", "schedule a", "get a visit", "ჯავშ", "დაჯავშნ", "ვიზიტ", "termin", "buchen", "rendez", "réserver", "prenot", "appuntament", "cita", "reservar", "записат", "запись", "приём", "прием" }),
        (Topic.Payment, new[] { "pay", "payment", "card", "cash", "upfront", "up front", "charge", "visa", "mastercard", "გადახდ", "ბარათ", "zahl", "karte", "paiement", "payer", "carte", "pagament", "pagare", "carta", "pago", "pagar", "tarjeta", "оплат", "карт" }),
        (Topic.Cancel, new[] { "cancel", "refund", "money back", "გაუქმ", "დაბრუნ", "stornier", "erstatt", "annul", "rembours", "annull", "rimbors", "cancelar", "reembols", "отмен", "возврат" }),
        (Topic.Reschedule, new[] { "reschedul", "change the time", "change my appointment", "move my appointment", "different time", "another time", "change the date", "გადატან", "verschieb", "déplacer", "spostare", "cambiar la cita", "перенес", "перенос" }),
        (Topic.Insurance, new[] { "insur", "coverage", "covered", "დაზღვ", "versicher", "assurance", "assicuraz", "seguro", "страхов" }),
        (Topic.Hours, new[] { "hours", "open", "opening", "closing", "what time", "when are you", "saturday", "sunday", "weekend", "closed", "სამუშაო საათ", "ღიაა", "შაბათ", "კვირა", "öffnungszeit", "geöffnet", "samstag", "sonntag", "horaire", "ouvert", "samedi", "dimanche", "orari", "aperto", "sabato", "domenica", "horario", "abierto", "sábado", "domingo", "часы работы", "открыт", "суббот", "воскресен" }),
        (Topic.Register, new[] { "register", "sign up", "signup", "create an account", "new account", "რეგისტრაც", "registrier", "konto erstellen", "inscri", "créer un compte", "registra", "crear una cuenta", "регистрац" }),
        (Topic.Login, new[] { "log in", "login", "sign in", "can t log", "cannot log", "cant log", "logged out", "შესვლ", "anmeld", "connexion", "connecter", "accedere", "accesso", "iniciar sesión", "войти", "вход" }),
        (Topic.Password, new[] { "password", "forgot", "reset", "პაროლ", "passwort", "mot de passe", "contraseña", "пароль" }),
        (Topic.Bills, new[] { "invoice", "receipt", "bill", "bills", "paid", "ქვითარ", "ინვოის", "rechnung", "quittung", "facture", "reçu", "fattura", "ricevuta", "factura", "recibo", "счет", "счёт", "чек" }),
        (Topic.Records, new[] { "record", "prescription", "medical history", "document", "test result", "lab result", "results", "upload", "allerg", "რეცეპტ", "დანიშნულ", "ჩანაწერ", "rezept", "befund", "ordonnance", "dossier", "ricetta", "cartella", "receta", "historial", "рецепт", "карт", "анализ" }),
        (Topic.Notifications, new[] { "notification", "remind", "reminder", "alert", "email me", "შეტყობინებ", "შეხსენებ", "benachrichtig", "erinnerung", "notification", "rappel", "notifica", "promemoria", "notificaci", "recordatorio", "уведомлен", "напоминан" }),
        (Topic.Reviews, new[] { "review", "rate", "rating", "feedback", "stars", "შეფასებ", "bewertung", "avis", "recension", "valutaz", "reseña", "valoraci", "отзыв", "оценк" }),
        (Topic.Profile, new[] { "profile picture", "profile photo", "photo", "avatar", "change my email", "change email", "my profile", "my account", "პროფილ", "profil", "perfil", "профил" }),
        (Topic.Contact, new[] { "address", "location", "where are you", "where is the clinic", "phone", "contact", "call you", "parking", "directions", "how to get", "მისამართ", "ტელეფონ", "adresse", "telefon", "téléphone", "indirizzo", "telefono", "dirección", "teléfono", "адрес", "телефон" }),
        (Topic.Price, new[] { "price", "prices", "cost", "how much", "fee", "expensive", "cheap", "ფას", "ღირ", "preis", "kosten", "kostet", "wie viel", "prix", "combien", "coût", "prezz", "quanto", "costo", "precio", "cuánto", "cuesta", "сколько", "цен", "стоимост" }),
        (Topic.Doctors, new[] { "doctor", "doctors", "specialist", "who works", "ექიმ", "arzt", "ärzt", "médecin", "medic", "médico", "врач" }),
        (Topic.Specializations, new[] { "specialization", "specialisation", "specialities", "specialties", "department", "what kind of doctor", "which doctor", "what doctor", "სპეციალობ", "fachrichtung", "spécialité", "specializzazion", "especialidad", "специальност" }),
        (Topic.Services, new[] { "services", "what do you offer", "treatments", "procedures", "სერვის", "მომსახურებ", "leistung", "services", "servizi", "servicios", "услуг" }),
        (Topic.Credentials, new[] { "qualified", "qualification", "certificate", "certified", "degree", "license", "licence", "experience", "სერტიფიკატ", "გამოცდილებ", "qualifikation", "erfahrung", "diplôme", "expérience", "esperienza", "experiencia", "опыт", "квалификац" })
    };

    /// <summary>Service-name words that say little on their own.</summary>
    private static readonly HashSet<string> GenericServiceWords = new() { "consultation", "session", "follow", "up", "general", "test" };

    // ---------------------------------------------------------------- reply

    public async Task<ChatAnswer> ReplyAsync(IReadOnlyList<ChatTurn> conversation, string? lang, CancellationToken cancellationToken)
    {
        var t = new Localizer(_text, lang);
        var clinic = await _directory.GetAsync(cancellationToken);
        var raw = conversation.LastOrDefault(x => x.Role == "user")?.Content ?? "";
        var msg = Normalize(raw);
        var words = msg.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        // 1. Safety first.
        if (Has(msg, SelfHarm))
            return Of(t, t.T("I'm really sorry you're going through this. You don't have to face it alone. If you might act on these thoughts or are in danger, please call 112 now or go to the nearest emergency department. Talking to someone you trust can help too. When you're ready, our psychiatrists can support you; you can find them on the Doctors page (/doctors)."),
                "Show me your psychiatrists");

        if (Has(msg, Emergency))
            return Of(t, t.T("If this is an emergency, please call 112 right now or go to the nearest emergency department. Don't wait for an online appointment. This chat can't help in an emergency."));

        if (Has(msg, AskHuman))
            return Of(t, t.T("I'm an automated assistant, not a person. For anything I can't answer, please ask the reception desk at the clinic. I can still help with doctors, prices, booking, payments and how to use this site."),
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
            var previous = conversation.Where(x => x.Role == "user").Reverse().Skip(1).FirstOrDefault();
            if (previous is not null)
            {
                var prevMsg = Normalize(previous.Content);
                var prevWords = prevMsg.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                doctors = MatchDoctors(prevWords, clinic);
                (services, exactService) = MatchServices(prevWords, clinic);
                specialties = MatchSpecialties(prevMsg, clinic);

                // "Who treats thyroid problems?" -> "How much?" is about that specialty's prices, not one service.
                if (specialties.Count > 0 && !exactService) services = new();
                if (specialties.Count > 0 && topics.Contains(Topic.Price)) return SpecialtyPrices(t, specialties[0], clinic);
            }
        }

        if (Has(msg, MedicalAdvice))
            return MedicalAdviceAnswer(t, specialties, clinic);

        if (doctors.Count > 0) return DoctorAnswer(t, doctors, topics);

        // "joint pain" is about a specialist; "joint injection price" or "ECG" is about the service.
        if (services.Count > 0 && (exactService || topics.Contains(Topic.Price) || specialties.Count == 0))
            return ServiceAnswer(t, services, clinic);

        if (specialties.Count > 0) return SpecialtyAnswer(t, specialties, clinic, symptomBased: !Has(msg, SpecialtyNames));

        if (topics.Count > 0)
        {
            if (topics.Any(x => !BroadTopics.Contains(x)))
                topics = topics.Where(x => !BroadTopics.Contains(x)).ToList();
            if (topics.Contains(Topic.Hours) && Has(msg, new[] { "saturday", "weekend", "შაბათ", "samstag", "samedi", "sabato", "sábado", "суббот" }))
                return SaturdayAnswer(t, clinic);
            if (topics[0] == Topic.Price && Has(msg, new[] { "consultation", "კონსულტაც", "beratung", "consulenz", "consulta", "консультац" }))
                return KindPrices(t, "consultation", clinic);

            var answers = topics.Take(2).Select(x => TopicAnswer(t, x, clinic)).ToList();
            var text = string.Join("\n\n", answers.Select(a => a.Text));
            var suggestions = answers.SelectMany(a => a.Suggestions).Distinct().Take(3).ToArray();
            return new ChatAnswer(text, suggestions);
        }

        // 3. Small talk.
        if (words.Length <= 6)
        {
            if (Has(msg, Thanks)) return Of(t, t.T("You're welcome! Is there anything else I can help you with?"), "How do I book a visit?");
            if (Has(msg, Bye)) return Of(t, t.T("Take care! If you need anything else, I'm here."));
            if (Has(msg, Greeting))
                return Of(t, t.T("Hello! How can I help you today?"),
                    "How do I book a visit?", "Which doctor should I see for back pain?", "What are your working hours?");
        }

        return Fallback(t);
    }

    /// <summary>An answer whose suggestion buttons are shown (and later sent back) in the visitor's language.</summary>
    private static ChatAnswer Of(Localizer t, string text, params string[] suggestions) =>
        new(text, suggestions.Select(s => t.T(s)).ToArray());

    // ---------------------------------------------------------------- answers

    private static ChatAnswer DoctorAnswer(Localizer t, List<DirectoryDoctor> doctors, List<Topic> topics)
    {
        if (doctors.Count > 1)
        {
            var sb = new StringBuilder(t.T("We have more than one doctor with that name:") + "\n");
            foreach (var d in doctors.Take(5))
                sb.AppendLine($"- {d.FullName}, {t.T(d.Specialization)} (/doctors/{d.Id})");
            sb.Append(t.T("Which one do you mean? You can write the first name too."));
            return new ChatAnswer(sb.ToString(), doctors.Take(3).Select(d => t.T("Tell me about {name}", ("name", d.FullName))).ToArray());
        }

        var doc = doctors[0];
        var text = new StringBuilder();
        text.AppendLine(t.T("{name} is {a_specialist} with {years} years of experience ({rating}).",
            ("name", doc.FullName), ("a_specialist", $"{Article(doc.Specialization)} {Singular(doc.Specialization)}"),
            ("specialization", t.T(doc.Specialization)), ("years", doc.Years), ("rating", RatingText(t, doc))));
        if (!string.IsNullOrWhiteSpace(doc.Bio) && !topics.Contains(Topic.Price) && !topics.Contains(Topic.Hours))
            text.AppendLine(doc.Bio);
        if (doc.Services.Count > 0)
            text.AppendLine(t.T("Services") + ": " + string.Join("; ", doc.Services.Select(s => $"{s.Name} {Money(s.Price)} ({t.T("{n} min", ("n", s.Minutes))})")) + ".");
        text.AppendLine(t.T("Working hours") + ": " + ClinicDirectory.DescribeHours(doc.Hours, t.Culture, t.T("not set yet")) + ".");
        text.Append(t.T("See the full profile and book a visit here:") + $" (/doctors/{doc.Id})");
        return Of(t, text.ToString(), "How does payment work?", "Can I cancel and get a refund?");
    }

    private static ChatAnswer ServiceAnswer(Localizer t, List<DirectoryService> services, ClinicSnapshot clinic)
    {
        var sb = new StringBuilder();
        if (services.Count == 1)
        {
            var s = services[0];
            sb.AppendLine(t.T("{service} costs {price} and takes about {minutes} minutes ({department}).",
                ("service", s.Name), ("price", Money(s.Price)), ("minutes", s.Minutes), ("department", t.T(s.Department))));
        }
        else
        {
            sb.AppendLine(t.T("Here are the matching services:"));
            foreach (var s in services.Take(5))
                sb.AppendLine($"- {s.Name}: {Money(s.Price)}, {t.T("{n} min", ("n", s.Minutes))} ({t.T(s.Department)})");
        }

        var names = services.Take(5).Select(s => s.Name).ToHashSet();
        var offeredBy = clinic.Doctors.Where(d => d.Services.Any(s => names.Contains(s.Name))).Take(4).ToList();
        if (offeredBy.Count > 0)
        {
            sb.AppendLine(t.T("Doctors who offer it:"));
            foreach (var d in offeredBy)
                sb.AppendLine($"- {d.FullName}, {t.T(d.Specialization)} (/doctors/{d.Id})");
        }
        sb.Append(t.T("If you have valid insurance on file, the insurance share is taken off when you pay."));
        return Of(t, sb.ToString(), "How do I book a visit?", "How does payment work?");
    }

    private static ChatAnswer SpecialtyAnswer(Localizer t, List<string> specialties, ClinicSnapshot clinic, bool symptomBased)
    {
        var sb = new StringBuilder();
        var first = true;
        foreach (var spec in specialties.Take(2))
        {
            var docs = clinic.Doctors.Where(d => d.Specialization == spec).ToList();
            if (!first) sb.AppendLine();
            first = false;

            var args = new (string, object?)[] { ("a_specialist", $"{Article(spec)} {Singular(spec)}"), ("specialists", Plural(spec)), ("specialization", t.T(spec)) };
            sb.AppendLine(symptomBased && specialties.Count == 1
                ? t.T("For that, people usually see {a_specialist}. Our {specialists}:", args)
                : t.T("Our {specialists}:", args));

            if (docs.Count == 0)
            {
                sb.AppendLine("- " + t.T("There is no doctor in this specialization right now."));
                continue;
            }

            foreach (var d in docs)
                sb.AppendLine($"- {d.FullName}, {t.T("{years} years of experience", ("years", d.Years))}, {RatingText(t, d)} (/doctors/{d.Id})");

            var services = docs.SelectMany(d => d.Services).DistinctBy(s => s.Name).ToList();
            if (services.Count > 0)
                sb.AppendLine(t.T("Services") + ": " + string.Join("; ", services.Select(s => $"{s.Name} {Money(s.Price)}")) + ".");
        }

        if (symptomBased)
            sb.Append(t.T("I can't give medical advice. The doctor will assess what is right for you during the visit."));
        return Of(t, sb.ToString().TrimEnd(), "How do I book a visit?", "How does payment work?");
    }

    private static ChatAnswer MedicalAdviceAnswer(Localizer t, List<string> specialties, ClinicSnapshot clinic)
    {
        var intro = t.T("I'm sorry, I can't give medical advice, diagnoses or medicine doses. A doctor needs to assess this. If it feels urgent or serious, call 112.");
        if (specialties.Count == 0)
            return Of(t, intro + " " + t.T("Tell me what the problem is about (for example skin, back pain or headaches) and I'll suggest which doctor to see."),
                "Which doctor should I see for headaches?", "How do I book a visit?");

        var spec = SpecialtyAnswer(t, specialties, clinic, symptomBased: false);
        return new ChatAnswer(intro + "\n\n" + spec.Text, spec.Suggestions);
    }

    private static ChatAnswer TopicAnswer(Localizer t, Topic topic, ClinicSnapshot clinic) => topic switch
    {
        Topic.Booking => Of(t,
            t.T("To book a visit:") + "\n" +
            "1. " + t.T("Log in (/login) or create an account (/register).") + "\n" +
            "2. " + t.T("Find a doctor on the Doctors page (/doctors) and press \"Book a visit\".") + "\n" +
            "3. " + t.T("Choose a service, a day and a free time.") + "\n" +
            "4. " + t.T("Pay by card to confirm. You'll see the visit in My appointments (/appointments).") + "\n" +
            t.T("You can book up to 90 days ahead."),
            "How does payment work?", "Which doctor should I see for back pain?"),

        Topic.Payment => Of(t,
            t.T("Online bookings are paid up front by card when you book. If you have valid insurance on file, the insurance share is taken off and you pay only your part. The invoice and receipt appear in My bills (/invoices). If the clinic books a visit for you, you can pay at the desk in cash, by card or by bank transfer."),
            "Can I cancel and get a refund?", "Which insurance do you accept?"),

        Topic.Cancel => Of(t,
            t.T("You can cancel in My appointments (/appointments) up to 2 hours before the visit. If you paid online, the full amount is refunded to your card automatically. Less than 2 hours before the visit, please contact the clinic. If the clinic has to cancel (for example the doctor is on leave), you're notified and refunded in full."),
            "How do I reschedule?", "How do I book a visit?"),

        Topic.Reschedule => Of(t,
            t.T("Open My appointments (/appointments), press \"Reschedule\" on the visit and pick a new free time. It works up to 2 hours before the visit, and your payment stays with the visit."),
            "Can I cancel and get a refund?"),

        Topic.Insurance => Of(t,
            (clinic.Insurers.Count > 0 ? t.T("We accept {insurers}.", ("insurers", JoinNames(t, clinic.Insurers))) + " " : "") +
            t.T("Your policy is added by the reception desk. Once it's on file, your insurance share is taken off automatically when you pay. You can see your policies in My health (/health)."),
            "How does payment work?"),

        Topic.Hours => HoursAnswer(t, clinic),

        Topic.Register => Of(t,
            t.T("Create an account on the Register page (/register) with your email, name, personal number, date of birth and a password (at least 8 characters). You need to be 18 or older to register online; children are registered by a parent or guardian at the reception desk. Then you can book visits and see your records online."),
            "How do I book a visit?"),

        Topic.Login => Of(t,
            t.T("To log in (/login) enter your email, your first and last name exactly as registered, and your password. Forgot your password? Reset it here: (/forgot-password)."),
            "I forgot my password"),

        Topic.Password => Of(t,
            t.T("Go to Reset password (/forgot-password), enter your email and we'll send you a 6-digit code. Enter the code and choose a new password. If you're logged in, you can also change it in My profile (/account)."),
            "How do I log in?"),

        Topic.Bills => Of(t,
            t.T("Your invoices, payments and printable receipts are in My bills (/invoices). Visits you book online are paid when you book; refunds show up there too."),
            "Can I cancel and get a refund?"),

        Topic.Records => Of(t,
            t.T("Log in and open My health (/health). There you'll find your medical records written by your doctors, prescriptions, documents (you can upload PDF, PNG or JPG files), allergies and insurance. You can also download a PDF summary of each visit. I can't see your records myself."),
            "How do I book a visit?"),

        Topic.Notifications => Of(t,
            t.T("You get an email reminder about 24 hours before each visit. Updates (bookings, changes, cancellations, refunds) also appear under the bell icon (/notifications). You can choose which emails you get in My profile (/account)."),
            "How do I reschedule?"),

        Topic.Reviews => Of(t,
            t.T("After a completed visit you can rate your doctor from 1 to 5 stars and leave a comment in My appointments (/appointments). Ratings are shown on each doctor's profile (/doctors)."),
            "Which doctors do you have?"),

        Topic.Profile => Of(t,
            t.T("In My profile (/account) you can upload a profile picture, edit your personal details, choose your language and theme, pick which emails you get, and change your password or email address."),
            "I forgot my password"),

        Topic.Contact => Of(t,
            t.T("Umbrella Medical Center is at 12 Shota Rustaveli Avenue, 0108 Tbilisi. Front desk: +995 32 255 12 12. You can also write to us on the Contact page (/contact). In an emergency, call 112."),
            "What are your working hours?"),

        Topic.Price => PriceOverview(t, clinic),

        Topic.Doctors or Topic.Specializations => Of(t,
            t.T("We have {doctors} doctors in {count} specializations: {list}.", ("doctors", clinic.Doctors.Count), ("count", clinic.Specializations.Count),
                ("list", JoinNames(t, clinic.Specializations.Select(s => t.T(s.Name)).ToList()))) + " " +
            t.T("Browse them on the Doctors page (/doctors). Tell me what you need help with (for example \"skin rash\" or \"knee pain\") and I'll suggest who to see."),
            "Which doctor should I see for headaches?", "Show me your dentists"),

        Topic.Services => PriceOverview(t, clinic),

        Topic.Credentials => Of(t,
            t.T("Every Umbrella doctor's medical degree and licence are checked by our Credentialing Office. You can see each doctor's experience, education and certificates on their profile (/doctors)."),
            "Which doctors do you have?"),

        _ => Fallback(t)
    };

    private static ChatAnswer HoursAnswer(Localizer t, ClinicSnapshot clinic)
    {
        const string open = "Umbrella Medical Center is open 24 hours a day, 7 days a week, including weekends and holidays.";
        var shifts = clinic.Doctors.SelectMany(d => d.Hours).ToList();
        if (shifts.Count == 0)
            return Of(t, t.T(open) + " " + t.T("Each doctor's visit hours are on their profile (/doctors)."));

        string Range(IEnumerable<DirectoryShift> s) => $"{s.Min(x => x.Start):HH\\:mm}-{s.Max(x => x.End):HH\\:mm}";

        var weekdays = shifts.Where(s => s.Day is >= DayOfWeek.Monday and <= DayOfWeek.Friday).ToList();
        var saturday = shifts.Where(s => s.Day == DayOfWeek.Saturday).ToList();
        var sunday = shifts.Where(s => s.Day == DayOfWeek.Sunday).ToList();

        var sb = new StringBuilder(t.T(open) + " ");
        sb.Append(weekdays.Count > 0 ? t.T("For booked visits, our doctors see patients Monday to Friday, {hours}.", ("hours", Range(weekdays))) : t.T("For booked visits, each doctor has set days."));
        if (saturday.Count > 0)
        {
            var count = clinic.Doctors.Count(d => d.Hours.Any(h => h.Day == DayOfWeek.Saturday));
            sb.Append(' ').Append(t.T("Some ({count}) also see patients on Saturday, {hours}.", ("count", count), ("hours", Range(saturday))));
        }
        sb.Append(' ').Append(sunday.Count > 0
            ? t.T("Some also see patients on Sunday, {hours}.", ("hours", Range(sunday)))
            : t.T("On Sundays the clinic is open, but booked doctor visits are not offered yet."));
        sb.Append(' ').Append(t.T("Each doctor has their own hours (many take a lunch break 13:00-14:00), shown on their profile (/doctors), and the booking page only offers free times."));
        return Of(t, sb.ToString(), "How do I book a visit?", "Which doctors work on Saturday?");
    }

    private static ChatAnswer SaturdayAnswer(Localizer t, ClinicSnapshot clinic)
    {
        var docs = clinic.Doctors.Where(d => d.Hours.Any(h => h.Day == DayOfWeek.Saturday)).ToList();
        if (docs.Count == 0)
            return Of(t, t.T("The clinic is open 24/7, including weekends, but no doctor offers booked visits on weekends at the moment. See each doctor's hours on their profile (/doctors)."));

        var sb = new StringBuilder(t.T("These doctors also see patients on Saturday:") + "\n");
        foreach (var d in docs)
        {
            var shifts = d.Hours.Where(h => h.Day == DayOfWeek.Saturday).OrderBy(h => h.Start);
            sb.AppendLine($"- {d.FullName}, {t.T(d.Specialization)}: {string.Join(", ", shifts.Select(h => $"{h.Start:HH\\:mm}-{h.End:HH\\:mm}"))} (/doctors/{d.Id})");
        }
        sb.Append(t.T("The clinic itself is open 24/7, including Sundays."));
        return Of(t, sb.ToString(), "How do I book a visit?");
    }

    private static ChatAnswer SpecialtyPrices(Localizer t, string specialization, ClinicSnapshot clinic)
    {
        var services = clinic.Doctors.Where(d => d.Specialization == specialization)
            .SelectMany(d => d.Services).DistinctBy(s => s.Name).ToList();
        if (services.Count == 0) return PriceOverview(t, clinic);

        var sb = new StringBuilder(t.T("Prices with our {specialists}:", ("specialists", Plural(specialization)), ("specialization", t.T(specialization))) + "\n");
        foreach (var s in services)
            sb.AppendLine($"- {s.Name}: {Money(s.Price)} ({t.T("{n} min", ("n", s.Minutes))})");
        sb.Append(t.T("If you have valid insurance on file, the insurance share is taken off when you pay."));
        return Of(t, sb.ToString(), "How do I book a visit?", "How does payment work?");
    }

    /// <summary>All services whose name contains a word, e.g. every "consultation".</summary>
    private static ChatAnswer KindPrices(Localizer t, string word, ClinicSnapshot clinic)
    {
        var services = clinic.Services.Where(s => s.Name.Contains(word, StringComparison.OrdinalIgnoreCase)).OrderBy(s => s.Price).ToList();
        if (services.Count == 0) return PriceOverview(t, clinic);

        var sb = new StringBuilder(t.T("Our consultations cost from {from} to {to}:", ("from", Money(services[0].Price)), ("to", Money(services[^1].Price))) + "\n");
        foreach (var s in services)
            sb.AppendLine($"- {s.Name}: {Money(s.Price)} ({t.T("{n} min", ("n", s.Minutes))})");
        sb.Append(t.T("Tell me what the visit is about and I'll suggest the right doctor."));
        return Of(t, sb.ToString(), "Which doctor should I see for back pain?", "How do I book a visit?");
    }

    private static ChatAnswer PriceOverview(Localizer t, ClinicSnapshot clinic)
    {
        var examples = clinic.Services.GroupBy(s => s.Department).Select(g => g.OrderBy(s => s.Price).First()).Take(8).ToList();
        var sb = new StringBuilder(t.T("Prices depend on the service. Some examples:") + "\n");
        foreach (var s in examples)
            sb.AppendLine($"- {s.Name}: {Money(s.Price)} ({t.T("{n} min", ("n", s.Minutes))})");
        sb.Append(t.T("Every doctor's prices are on their profile (/doctors). Which service are you interested in?"));
        return Of(t, sb.ToString(), "How much is an eye examination?", "How does payment work?");
    }

    private static ChatAnswer Fallback(Localizer t) =>
        Of(t, t.T("Sorry, I didn't quite understand that. I can help with our doctors and which one to see, prices, booking, payment and refunds, insurance, working hours and using the website. For anything else, please ask the reception desk."),
            "How do I book a visit?", "Which doctor should I see for back pain?", "How much is a consultation?", "What are your working hours?");

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
        "psychiat", "endocrin", "urolog", "radiolog", "ent ", "gp ", "general practitioner", "family doctor", "otolaryng",
        "სტომატოლოგ", "დერმატოლოგ", "კარდიოლოგ", "პედიატრ", "ნევროლოგ", "ორთოპედ", "ოფთალმოლოგ", "გინეკოლოგ", "ფსიქიატრ",
        "ენდოკრინოლოგ", "უროლოგ", "რადიოლოგ", "თერაპევტ", "zahnarzt", "hautarzt", "kardiolog", "kinderarzt", "hausarzt", "frauenarzt",
        "dentiste", "dermatolog", "cardiolog", "pédiatre", "dentista", "pediatra", "стоматолог", "дерматолог", "кардиолог", "педиатр",
        "невролог", "ортопед", "офтальмолог", "гинеколог", "психиатр", "эндокринолог", "уролог", "терапевт"
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
            var tokens = Normalize(service.Name).Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(x => x.Length >= 3).ToList();
            if (tokens.Count == 0) continue;

            var matched = tokens.Where(x => words.Any(w => WordMatches(w, x))).ToList();
            var specific = matched.Count(x => !GenericServiceWords.Contains(x));
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
            .Select(x => (x.Topic, Hits: x.Words.Count(w => HasWord(msg, w))))
            .Where(x => x.Hits > 0)
            .OrderByDescending(x => x.Hits)
            .ThenBy(x => (int)x.Topic)
            .Select(x => x.Topic)
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

    private static string Money(decimal amount) => $"{amount.ToString("0.##", C)} GEL";

    private static string RatingText(Localizer t, DirectoryDoctor d) =>
        d.Reviews == 0 ? t.T("no reviews yet")
        : d.Reviews == 1 ? t.T("rated {rating}/5 by 1 patient", ("rating", d.Rating.ToString("0.0", C)))
        : t.T("rated {rating}/5 by {count} patients", ("rating", d.Rating.ToString("0.0", C)), ("count", d.Reviews));

    // English grammar helpers; other languages use the {specialization} placeholder instead.
    private static string Singular(string specialization) => specialization switch
    {
        "Otolaryngologist (ENT)" => "ENT specialist",
        _ => specialization.ToLowerInvariant()
    };

    private static string Plural(string specialization) => Singular(specialization) + "s";

    private static string Article(string specialization) =>
        "aeiou".Contains(char.ToLowerInvariant(Singular(specialization)[0])) ? "an" : "a";

    private static string JoinNames(Localizer t, IReadOnlyList<string> names) =>
        names.Count <= 1 ? string.Join("", names) : string.Join(", ", names.Take(names.Count - 1)) + " " + t.T("and") + " " + names[^1];
}

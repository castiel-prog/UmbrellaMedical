using System;
using System.Collections.Generic;
using System.Text;

namespace UmbrellaMedical.Domain.Enums
{
    public enum UserTokenPurpose 
    { 
      EmailVerification = 1,
    PasswordReset = 2,
    EmailChange = 3
    }
}

const mailer = require("../config/mailer");

async function sendVerificationEmail(to, firstName, confirmUrl) {
  const emailHtml = `
<div
  style="
    max-width:600px;
    margin:0 auto;
    font-family:Arial,sans-serif;
    color:#333;
    border:1px solid #e0e0e0;
    border-radius:8px;
    padding:2rem;
    box-shadow:0 2px 8px rgba(0,0,0,0.05);
  "
>
  <div style="text-align:center; margin-bottom:2rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
    <img
      src="https://res.cloudinary.com/dcoxo8snb/image/upload/logo_ytvglm.png"
      alt="Xtera Logo"
      width="48"
      style="display:block;"
    />
    <h1 style="margin:0; font-size:1.5rem; color:#005eff;"></h1>
  </div>

  <p style="font-size:1rem; line-height:1.5;">
    Hi <b>${firstName}</b>,
  </p>

  <p style="font-size:1rem; line-height:1.5;">
    Thanks for registering with Xtera! Please click the button below to confirm your email address and complete your account setup.
  </p>

  <div style="text-align:center; margin:2rem 0;">
    <a
      href="${confirmUrl}"
      style="
        display:inline-block;
        text-decoration:none;
        background-color:#005eff;
        color:#ffffff;
        padding:0.75rem 1.5rem;
        border-radius:4px;
        font-weight:bold;
        font-size:1rem;
      "
    >
      Confirm your email
    </a>
  </div>

  <p style="font-size:0.9rem;color:#666;line-height:1.4;">
    If that button doesn’t work, copy and paste this link into your browser:<br>
    <a href="${confirmUrl}" style="color:#005eff;">${confirmUrl}</a>
  </p>

  <p style="font-size:0.8rem;color:#999;line-height:1.2;">
    This link will expire in 24 hours.
  </p>
</div>
`;

  await mailer.sendMail({
    to,
    from: '"Xtera" <judexchange@zohomail.com>',
    subject: "Please confirm your email",
    html: emailHtml,
  });
}

async function sendExpiredVerificationEmail(to, firstName, confirmUrl) {
  const emailHtml = `
    <div
      style="
        max-width:600px;
        margin:0 auto;
        font-family:Arial,sans-serif;
        color:#333;
        border:1px solid #e0e0e0;
        border-radius:8px;
        padding:2rem;
        box-shadow:0 2px 8px rgba(0,0,0,0.05);
      "
    >
      <div style="
          text-align:center;
          margin-bottom:2rem;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:0.5rem;
        ">
        <img
          src="https://res.cloudinary.com/dcoxo8snb/image/upload/logo_ytvglm.png"
          alt="Xtera Logo"
          width="65"
          style="display:block;"
        />
      </div>
  
      <p style="font-size:1rem; line-height:1.5;">
        Hi <strong>${firstName}</strong>,
      </p>
  
      <p style="font-size:1rem; line-height:1.5;">
        It looks like your previous verification link has expired. No worries—we’ve generated a new one just for you!
      </p>
  
      <div style="text-align:center; margin:2rem 0;">
        <a
          href="${confirmUrl}"
          style="
            display:inline-block;
            text-decoration:none;
            background-color:#005eff;
            color:#ffffff;
            padding:0.75rem 1.5rem;
            border-radius:4px;
            font-weight:bold;
            font-size:1rem;
          "
        >
          Confirm Your Email Again
        </a>
      </div>
  
      <p style="font-size:0.9rem; color:#666; line-height:1.4;">
        If that button doesn’t work, copy & paste this link into your browser:<br/>
        <a href="${confirmUrl}" style="color:#005eff;">${confirmUrl}</a>
      </p>
  
      <p style="font-size:0.8rem; color:#999; line-height:1.2;">
        This new link will expire in 24 hours.
      </p>
  
      <hr style="margin:2rem 0; border:none; border-top:1px solid #e0e0e0;" />
  
      <p style="font-size:0.8rem; color:#999; line-height:1.2;">
        Didn’t request this? You can safely ignore this email, or <a href="mailto:support@xtera.com" style="color:#005eff;">contact support</a>.
      </p>
    </div>
    `;

  await mailer.sendMail({
    to,
    from: '"Xtera" <judexchange@zohomail.com>',
    subject: "Your verification link has expired—here’s a new one",
    html: emailHtml,
  });
}

module.exports = { sendVerificationEmail, sendExpiredVerificationEmail };

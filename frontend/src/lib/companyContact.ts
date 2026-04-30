export const COMPANY_CONTACT = {
  callPhone: "7277 254 254",
  whatsappPhone: "7277 367 367",
  email: "info@letsednovate.com",
  addressLines: [
    "Ednovate",
    "4th Floor,",
    "Ajanta Square Mall,",
    "Near Borivali Court,",
    "Market Lane,",
    "Borivali West",
    "Mumbai - 400092",
  ],
};

export const COMPANY_ADDRESS_TEXT = COMPANY_CONTACT.addressLines.join(" ");

export const toIndiaDialDigits = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};

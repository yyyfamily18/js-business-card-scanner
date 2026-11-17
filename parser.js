/**
 * Parses raw OCR text from a business card into structured fields.
 */
function parseBusinessCardText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 1);

  const result = {
    full_name: "",
    job_title: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    address: ""
  };

  const titleKeywords = /\b(ceo|cto|cfo|coo|founder|director|manager|engineer|developer|designer|consultant|specialist|analyst|lead|head|president|vp|officer|architect|coordinator|associate)\b/i;
  const companyKeywords = /\b(inc|llc|ltd|corp|corporation|co\.|company|group|technologies|solutions|studio|agency|systems|enterprises|partners|labs)\b/i;
  const addressKeywords = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|suite|ste|floor|fl|drive|dr|lane|ln|way|plaza|tower|building)\b/i;

  const remainingLines = [];

  for (const line of lines) {
    // 1. Extract Email
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !result.email) {
      result.email = emailMatch[0].toLowerCase();
      continue;
    }

    // 2. Extract Website (avoid matching email domains)
    const urlMatch = line.match(/(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.(com|io|org|net|co|ai|dev|hk|au|uk)(\/[^\s]*)?/i);
    if (urlMatch && !line.includes("@") && !result.website) {
      let url = urlMatch[0];
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      result.website = url.toLowerCase();
      continue;
    }

    // 3. Extract Phone Number
    const phoneMatch = line.match(/(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/);
    const digitCount = (line.match(/\d/g) || []).length;
    if (phoneMatch && digitCount >= 7 && !addressKeywords.test(line) && !result.phone) {
      result.phone = phoneMatch[0].trim();
      continue;
    }

    remainingLines.push(line);
  }

  // 4. Classify remaining lines into Job Title, Company, Address, and Name
  const unclassified = [];
  for (const line of remainingLines) {
    if (!result.job_title && titleKeywords.test(line)) {
      result.job_title = line;
    } else if (!result.company && companyKeywords.test(line)) {
      result.company = line;
    } else if (!result.address && (addressKeywords.test(line) || /\b\d{4,6}\b/.test(line))) {
      result.address = line;
    } else {
      unclassified.push(line);
    }
  }

  // First clean 2-4 word alphabetic line is typically the person's name
  for (let i = 0; i < unclassified.length; i++) {
    const candidate = unclassified[i];
    if (/^[A-Za-z\s.'-]{3,40}$/.test(candidate) && candidate.split(/\s+/).length <= 4) {
      result.full_name = candidate;
      unclassified.splice(i, 1);
      break;
    }
  }

  // Fallback for company name if not caught by corporate suffixes
  if (!result.company && unclassified.length > 0) {
    result.company = unclassified.shift();
  }

  // Append any leftover line to address/notes
  if (unclassified.length > 0) {
    result.address = result.address
      ? `${result.address}, ${unclassified.join(", ")}`
      : unclassified.join(", ");
  }

  return result;
}

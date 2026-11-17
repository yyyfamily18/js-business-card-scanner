/**
 * v2 Business Card Parser
 * - Strips leading OCR icon noise (: = z • |)
 * - Recognizes legal/medical/HK professional titles (Solicitor, LL.B, etc.)
 * - Separates Office/Mobile phones from Fax numbers
 * - Captures multiple phone numbers
 */
function parseBusinessCardText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    // Strip leading OCR bullet/icon artifacts (e.g., ": ", "= ", "z ", "• ")
    .map(line => line.replace(/^[:;=•·|»>\-\s]+|^[a-z]\s+(?=[A-Z])/g, "").trim())
    .filter(line => line.length > 1);

  const result = {
    full_name: "",
    job_title: "",
    company: "",
    email: "",
    phone: "",
    fax: "",
    website: "",
    address: ""
  };

  const titleKeywords = /\b(ceo|cto|cfo|coo|founder|director|manager|engineer|developer|designer|consultant|specialist|analyst|lead|head|president|vp|officer|architect|coordinator|associate|solicitor|barrister|counsel|partner|celebrant|ll\.?b|ll\.?m|phd|md|dds|bds)\b/i;
  const companyKeywords = /\b(inc|llc|ltd|limited|corp|corporation|co\.|company|group|technologies|solutions|studio|agency|systems|enterprises|partners|labs|solicitors|chambers|clinic|dental)\b/i;
  const addressKeywords = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|suite|ste|floor|fl|flat|room|rm|drive|dr|lane|ln|way|plaza|tower|centre|center|building|hong kong|kowloon|new territories|central|yuen long)\b/i;

  const phones = [];
  const remainingLines = [];

  for (const line of lines) {
    // 1. Extract Email (handles "E-mail : name@domain.com")
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !result.email) {
      result.email = emailMatch[0].toLowerCase();
    }

    // 2. Extract Website (ignore email domains)
    const lineWithoutEmail = line.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "");
    const urlMatch = lineWithoutEmail.match(/(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.(com|io|org|net|co|ai|dev|hk|au|uk)(\.[a-z]{2})?(\/[^\s]*)?/i);
    if (urlMatch && !result.website) {
      let url = urlMatch[0];
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      result.website = url.toLowerCase();
    }

    // 3. Extract Fax vs. Phone numbers (supports HK 8-digit & international formats)
    const phoneRegex = /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{4}[\s.-]?\d{4}/g;
    const isFaxLine = /\bfax\b/i.test(line);
    const isTelLine = /\b(tel|phone|mobile|mob|direct|whatsapp)\b/i.test(line);

    if (isFaxLine) {
      const faxMatch = line.match(phoneRegex);
      if (faxMatch && !result.fax) result.fax = faxMatch[0].trim();
      continue;
    }

    if (isTelLine || (!addressKeywords.test(line) && (line.match(/\d/g) || []).length >= 8)) {
      const foundPhones = line.match(phoneRegex);
      if (foundPhones) {
        foundPhones.forEach(p => {
          if (!phones.includes(p.trim())) phones.push(p.trim());
        });
        // If the line was purely a phone/email line, skip adding to remainingLines
        if (isTelLine || emailMatch) continue;
      }
    }

    if (!emailMatch && !urlMatch) {
      remainingLines.push(line);
    }
  }

  result.phone = phones.join(" / ");

  // 4. Separate Name + Inline Title (e.g. "Veronica W.Y. Lau Solicitor") & classify lines
  const titles = [];
  const unclassified = [];

  for (const line of remainingLines) {
    if (companyKeywords.test(line) && !result.company) {
      result.company = line;
    } else if (addressKeywords.test(line) || /\b\d{4,6}\b/.test(line)) {
      result.address = result.address ? `${result.address}, ${line}` : line;
    } else if (titleKeywords.test(line)) {
      // Check if a person's name precedes the title on the same line (e.g. "Veronica W.Y. Lau Solicitor")
      const splitMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z]\.?){0,3}\s+[A-Z][a-z]+)\s+(.+)$/);
      if (splitMatch && !result.full_name) {
        result.full_name = splitMatch[1].trim();
        titles.push(splitMatch[2].trim());
      } else {
        titles.push(line);
      }
    } else {
      unclassified.push(line);
    }
  }

  result.job_title = titles.join(", ");

  // 5. Extract Name from remaining clean lines if not already found
  for (let i = 0; i < unclassified.length; i++) {
    const candidate = unclassified[i];
    if (/^[A-Za-z\s.'-]{3,40}$/.test(candidate) && candidate.split(/\s+/).length <= 4) {
      result.full_name = candidate;
      unclassified.splice(i, 1);
      break;
    }
  }

  // Leftover text goes to notes/address
  if (unclassified.length > 0) {
    result.address = result.address
      ? `${result.address} | ${unclassified.join(", ")}`
      : unclassified.join(", ");
  }

  return result;
}

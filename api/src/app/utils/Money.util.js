/** All money in this API is INTEGER satang (1/100 บาท) — see docs/backend/02-database.md. */

function satangToBaht(satang) {
  return Math.round(satang) / 100;
}

function bahtToSatang(baht) {
  return Math.round(baht * 100);
}

const DIGIT_NAMES = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE_NAMES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

/** Thai baht text, e.g. 155000 satang -> "หนึ่งพันห้าร้อยห้าสิบบาทถ้วน". Whole baht only for now. */
function toThaiText(satang) {
  let baht = Math.floor(satangToBaht(satang));
  if (baht === 0) return "ศูนย์บาทถ้วน";

  const readChunk = (numStr) => {
    let out = "";
    const len = numStr.length;
    for (let i = 0; i < len; i++) {
      const digit = Number(numStr[i]);
      const place = len - i - 1;
      if (digit === 0) continue;
      if (place === 0 && digit === 1 && len > 1) {
        out += "เอ็ด";
      } else if (place === 1 && digit === 2) {
        out += "ยี่" + PLACE_NAMES[1];
      } else if (place === 1 && digit === 1) {
        out += PLACE_NAMES[1];
      } else {
        out += DIGIT_NAMES[digit] + (PLACE_NAMES[place] || "");
      }
    }
    return out;
  };

  let text = "";
  let millions = "";
  while (baht > 0) {
    const chunk = baht % 1000000;
    millions = readChunk(String(chunk)) + (millions ? "ล้าน" + millions : "");
    baht = Math.floor(baht / 1000000);
  }
  text = millions;

  return `${text}บาทถ้วน`;
}

module.exports = { satangToBaht, bahtToSatang, toThaiText };

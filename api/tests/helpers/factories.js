const bcrypt = require("bcrypt");

let counter = 0;
function uuid() {
  counter += 1;
  return `00000000-0000-7000-8000-${String(counter).padStart(12, "0")}`;
}

/** Shaped like a Sequelize Staff instance — real fields plus a spy-able save() and the
 *  model's own toSafeJSON() (see src/app/models/Staff.model.js) — close enough for
 *  Auth.helper.js, which is all that ever touches it once src/app/models is mocked. */
function makeStaff(overrides = {}) {
  const staff = {
    _id: uuid(),
    title: "mr",
    first_name: "Test",
    last_name: "Staff",
    nickname: "tester",
    email: "tester@tcos.app",
    password_hash: null,
    phone: null,
    line_id: null,
    role: "staff",
    signature_image: null,
    ...overrides,
  };
  staff.save = jest.fn().mockResolvedValue(staff);
  staff.destroy = jest.fn().mockResolvedValue(staff);
  staff.set = jest.fn(function set(patch) {
    Object.assign(this, patch);
    return this;
  });
  staff.toSafeJSON = function toSafeJSON() {
    const { password_hash, save, destroy, set, toSafeJSON: _drop, ...safe } = this;
    return safe;
  };
  return staff;
}

/** Low cost factor — fast fixture hashing, still real bcrypt (bcrypt.compare reads the cost
 *  out of the hash itself, so this doesn't need to match production's BCRYPT_ROUNDS). */
function hashed(password) {
  return bcrypt.hash(password, 4);
}

module.exports = { makeStaff, hashed, uuid };

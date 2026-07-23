const { Model, DataTypes } = require("sequelize");
const { TITLES, ROLES } = require("../utils/enums.util");

class Staff extends Model {
  static initModel(sequelize) {
    Staff.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        title: DataTypes.ENUM(...TITLES),
        first_name: { type: DataTypes.TEXT, allowNull: false },
        last_name: { type: DataTypes.TEXT, allowNull: false },
        nickname: { type: DataTypes.TEXT, allowNull: false },
        // Plain TEXT UNIQUE in the shipped schema — case-SENSITIVE. Lowercase both sides
        // yourself when querying by email until doc 02 §6 gap #4 (citext) is closed.
        email: { type: DataTypes.TEXT, allowNull: false, unique: true },
        password_hash: DataTypes.TEXT,
        phone: DataTypes.STRING(10),
        line_id: DataTypes.TEXT,
        role: { type: DataTypes.ENUM(...ROLES), defaultValue: "staff" },
        signature_image: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: "Staff",
        tableName: "staff",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        // No DB trigger touches this column (doc 02 §6 gap #3) — harmless as long as every
        // write goes through Sequelize, since it sets updated_at at the ORM level regardless
        // of triggers. Only raw SQL bypassing Sequelize would silently skip it.
        updatedAt: "updated_at",
      }
    );
    return Staff;
  }

  static associate({ BankAccount, StaffDept }) {
    Staff.hasMany(BankAccount, { foreignKey: "staff_id", as: "bankAccounts" });
    Staff.hasMany(StaffDept, { foreignKey: "staff_id", as: "memberships" });
  }

  toSafeJSON() {
    const { password_hash, ...safe } = this.toJSON();
    return safe;
  }
}

module.exports = Staff;

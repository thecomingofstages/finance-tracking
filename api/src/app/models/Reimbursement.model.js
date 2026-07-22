const { Model, DataTypes } = require("sequelize");
const { REIMBURSEMENT_STATUSES } = require("../utils/enums.util");

class Reimbursement extends Model {
  static initModel(sequelize) {
    Reimbursement.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        staff_dept_id: { type: DataTypes.UUID, allowNull: false },
        tag_id: DataTypes.UUID, // optional
        purpose: { type: DataTypes.TEXT, allowNull: false },
        // No unique constraint yet — doc 02 §6 gap #6.
        tracking_id: DataTypes.TEXT,
        banking_id: DataTypes.UUID, // null -> pay in cash
        receipt_link: DataTypes.TEXT, // R2 object key, not a public URL
        // Trigger-synced by trg_sync_reimbursement_latest_status on every
        // reimbursement_updatestatus insert — this is real, unlike most cached columns here.
        latest_status: { type: DataTypes.ENUM(...REIMBURSEMENT_STATUSES), defaultValue: "waiting" },
        // No total_amount column exists yet (doc 02 §6 gap #2) — see the totalAmount getter.
      },
      {
        sequelize,
        modelName: "Reimbursement",
        tableName: "reimbursement",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
    return Reimbursement;
  }

  static associate({ StaffDept, ProjectTag, BankAccount, ReimbursementDetail, ReimbursementStatus }) {
    Reimbursement.belongsTo(StaffDept, { foreignKey: "staff_dept_id", as: "staffDept" });
    Reimbursement.belongsTo(ProjectTag, { foreignKey: "tag_id", as: "tag" });
    Reimbursement.belongsTo(BankAccount, { foreignKey: "banking_id", as: "bankAccount" });
    Reimbursement.hasMany(ReimbursementDetail, { foreignKey: "reimbursement_id", as: "details" });
    Reimbursement.hasMany(ReimbursementStatus, { foreignKey: "reimbursement_id", as: "history" });
  }

  /** No cached column for this yet — sum on demand. Requires `details` to be eager-loaded. */
  get totalAmount() {
    return (this.details ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  }
}

module.exports = Reimbursement;

const { Model, DataTypes } = require("sequelize");

class ReimbursementDetail extends Model {
  static initModel(sequelize, schema) {
    ReimbursementDetail.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          field: "_id",
          defaultValue: sequelize.literal(`${schema}.uuid_generate_v7()`),
        },
        reimbursement_id: { type: DataTypes.UUID, allowNull: false },
        title: { type: DataTypes.TEXT, allowNull: false },
        // No CHECK constraint in the shipped schema (doc 02 §6 gap #8) — enforce > 0 here.
        amount: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: { min: { args: [1], msg: "amount must be greater than 0" } },
        },
      },
      {
        sequelize,
        schema,
        modelName: "ReimbursementDetail",
        tableName: "reimbursement_detail",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
    return ReimbursementDetail;
  }

  static associate({ Reimbursement }) {
    ReimbursementDetail.belongsTo(Reimbursement, { foreignKey: "reimbursement_id", as: "reimbursement" });
  }
}

module.exports = ReimbursementDetail;

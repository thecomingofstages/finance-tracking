const { Model, DataTypes } = require("sequelize");

class StaffDept extends Model {
  static initModel(sequelize) {
    StaffDept.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        staff_id: DataTypes.UUID,
        department_id: DataTypes.UUID,
        is_head: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_finance: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_manager: { type: DataTypes.BOOLEAN, defaultValue: false },
      },
      {
        sequelize,
        modelName: "StaffDept",
        tableName: "staff_dept",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at", // leave time
        createdAt: "created_at",
        updatedAt: false,
      }
    );
    return StaffDept;
  }

  static associate({ Staff, Department, Reimbursement }) {
    StaffDept.belongsTo(Staff, { foreignKey: "staff_id", as: "staff" });
    StaffDept.belongsTo(Department, { foreignKey: "department_id", as: "department" });
    StaffDept.hasMany(Reimbursement, { foreignKey: "staff_dept_id", as: "reimbursements" });
  }
}

module.exports = StaffDept;

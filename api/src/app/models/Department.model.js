const { Model, DataTypes } = require("sequelize");

class Department extends Model {
  static initModel(sequelize) {
    Department.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        project_id: { type: DataTypes.UUID, allowNull: false },
        name: DataTypes.TEXT,
        allocated_budget: { type: DataTypes.INTEGER, defaultValue: 0 },
        total_expense: { type: DataTypes.INTEGER, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: "Department",
        tableName: "department",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
    return Department;
  }

  static associate({ Project, StaffDept }) {
    Department.belongsTo(Project, { foreignKey: "project_id", as: "project" });
    Department.hasMany(StaffDept, { foreignKey: "department_id", as: "memberships" });
  }
}

module.exports = Department;

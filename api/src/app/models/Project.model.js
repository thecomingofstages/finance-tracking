const { Model, DataTypes } = require("sequelize");

class Project extends Model {
  static initModel(sequelize) {
    Project.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        name: { type: DataTypes.TEXT, allowNull: false },
        description: DataTypes.TEXT,
        allocated_budget: { type: DataTypes.INTEGER, defaultValue: 0 },
        // trigger-maintained in theory — no trigger ships yet, see docs/backend/02-database.md §6
        total_income: { type: DataTypes.INTEGER, defaultValue: 0 },
        total_expense: { type: DataTypes.INTEGER, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: "Project",
        tableName: "project",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
    return Project;
  }

  static associate({ ProjectTag, Department, Source }) {
    Project.hasMany(ProjectTag, { foreignKey: "project_id", as: "tags" });
    Project.hasMany(Department, { foreignKey: "project_id", as: "departments" });
    Project.hasMany(Source, { foreignKey: "project_id", as: "sources" });
  }
}

module.exports = Project;

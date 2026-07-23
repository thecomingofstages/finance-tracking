const { Model, DataTypes } = require("sequelize");

class ProjectTag extends Model {
  static initModel(sequelize) {
    ProjectTag.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        project_id: { type: DataTypes.UUID, allowNull: false },
        name: DataTypes.TEXT,
        allocated_budget: { type: DataTypes.INTEGER, defaultValue: 0 },
        total_income: { type: DataTypes.INTEGER, defaultValue: 0 },
        total_expense: { type: DataTypes.INTEGER, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: "ProjectTag",
        tableName: "project_tag",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
    return ProjectTag;
  }

  static associate({ Project, Source, Reimbursement }) {
    ProjectTag.belongsTo(Project, { foreignKey: "project_id", as: "project" });
    ProjectTag.hasMany(Source, { foreignKey: "tag_id", as: "sources" });
    ProjectTag.hasMany(Reimbursement, { foreignKey: "tag_id", as: "reimbursements" });
  }
}

module.exports = ProjectTag;

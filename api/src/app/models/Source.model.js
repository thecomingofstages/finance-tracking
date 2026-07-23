const { Model, DataTypes } = require("sequelize");
const { SOURCE_TYPES } = require("../utils/enums.util");

class Source extends Model {
  static initModel(sequelize) {
    Source.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        type: { type: DataTypes.ENUM(...SOURCE_TYPES), allowNull: false },
        reference_id: DataTypes.UUID, // activity_id | store_id | null — no DB-level required-for-type check
        tag_id: DataTypes.UUID, // optional — resolved open question #5, see doc 02
        project_id: { type: DataTypes.UUID, allowNull: false }, // the real anchor
        expect_amount: { type: DataTypes.INTEGER, defaultValue: 0 }, // note: expect_, not expected_
        // trigger-maintained in theory — no trigger ships yet, see docs/backend/02-database.md §6
        actual_amount: { type: DataTypes.INTEGER, defaultValue: 0 },
        name: { type: DataTypes.TEXT, allowNull: false },
      },
      {
        sequelize,
        modelName: "Source",
        tableName: "source",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
    return Source;
  }

  static associate({ Project, ProjectTag, Payment }) {
    Source.belongsTo(Project, { foreignKey: "project_id", as: "project" });
    Source.belongsTo(ProjectTag, { foreignKey: "tag_id", as: "tag" });
    Source.hasMany(Payment, { foreignKey: "source_id", as: "payments" });
  }
}

module.exports = Source;

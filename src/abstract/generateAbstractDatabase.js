/** @typedef {import('graphql').GraphQLSchema} GraphQLSchema */
/** @typedef {import('graphql').GraphQLObjectType} GraphQLObjectType */
/** @typedef {import('graphql').GraphQLField} GraphQLField */
/** @typedef {import('graphql').GraphQLOutputType} GraphQLOutputType */
/** @typedef {import('../..').AbstractDatabase} AbstractDatabase */
/** @typedef {import('../..').Table} Table */
/** @typedef {import('../..').TableColumn} TableColumn */
/** @typedef {import('../..').TableColumnType} TableColumnType */
/** @typedef {import('../..').ForeignKey} ForeignKey */

const {
  isObjectType,
  isScalarType,
  isEnumType,
  isListType,
  isNonNullType,
} = require('graphql')
const getColumnTypeFromScalar = require('./getColumnTypeFromScalar')
const parseAnnotations = require('../annotations/parseAnnotations')

const ROOT_TYPES = ['Query', 'Mutation', 'Subscription']

const INDEX_TYPES = [
  { annotation: 'index', list: 'indexes', hasType: true },
  { annotation: 'unique', list: 'uniques' },
]

/**
 * @param {GraphQLSchema} schema
 * @returns {Promise.<AbstractDatabase>}
 */
module.exports = async function (schema) {
  const builder = new AbstractDatabaseBuilder(schema)
  return builder.build()
}

class AbstractDatabaseBuilder {
  /**
   * @param {GraphQLSchema} schema
   */
  constructor (schema) {
    this.schema = schema
    this.typeMap = this.schema.getTypeMap()

    /** @type {AbstractDatabase} */
    this.database = {
      tables: [],
      tableMap: new Map(),
    }
  }

  /**
   * @returns {AbstractDatabase}
   **/
  build () {
    for (const key in this.typeMap) {
      const type = this.typeMap[key]
      // Tables
      if (isObjectType(type) && type.astNode && !ROOT_TYPES.includes(type.name)) {
        this.buildTable(type)
      }
    }
    this.fillForeignKeys()
    return this.database
  }

  /**
   * @param {GraphQLObjectType} type
   */
  buildTable (type) {
    const annotations = parseAnnotations(type.description || null)

    /** @type {Table} */
    const table = {
      name: annotations.name || type.name,
      comment: type.description || null,
      columns: [],
      columnMap: new Map(),
      indexes: [],
      uniques: [],
    }

    this.currentTable = table
    this.currentType = type.name

    const fields = type.getFields()
    for (const key in fields) {
      const field = fields[key]
      this.buildColumn(table, field)
    }

    this.currentTable = null
    this.currentType = null

    this.database.tables.push(table)
    this.database.tableMap.set(type.name, table)
    return table
  }

  /**
   * @param {Table} table
   * @param {GraphQLField} field
   */
  buildColumn (table, field) {
    const descriptor = this.getFieldDescriptor(field)
    if (!descriptor) return
    table.columns.push(descriptor)
    table.columnMap.set(field.name, descriptor)
    return descriptor
  }

  /**
   * @param {GraphQLField} field
   * @param {GraphQLOutputType?} fieldType
   * @return {TableColumn?}
   */
  getFieldDescriptor (field, fieldType = null) {
    const annotations = parseAnnotations(field.description || null)
    if (!fieldType) {
      fieldType = isNonNullType(field.type) ? field.type.ofType : field.type
    }

    /** @type {string} */
    let columnName = annotations.name || field.name
    /** @type {TableColumnType} */
    let type
    /** @type {any[]} */
    let args
    /** @type {ForeignKey?} */
    let foreign = null

    // Scalar
    if (isScalarType(fieldType) || annotations.type) {
      const descriptor = getColumnTypeFromScalar(field, isScalarType(fieldType) ? fieldType : null, annotations)
      if (!descriptor) {
        console.warn(`Unsupported type ${fieldType} on field ${field.name}.`)
        return null
      }
      type = descriptor.type
      args = descriptor.args

    // Enum
    } else if (isEnumType(fieldType)) {
      type = 'enum'
      args = [fieldType.getValues().map(v => v.name)]

    // Object
    } else if (isObjectType(fieldType)) {
      columnName = annotations.name || `${field.name}_foreign`
      const foreignType = this.typeMap[fieldType.name]
      if (!foreignType) {
        console.warn(`Foreign type ${fieldType.name} not found on field ${field.name}.`)
        return null
      }
      if (!isObjectType(foreignType)) {
        console.warn(`Foreign type ${fieldType.name} is not Object type on field ${field.name}.`)
        return null
      }
      const foreignKey = annotations.foreign || 'id'
      const foreignField = foreignType.getFields()[foreignKey]
      if (!foreignField) {
        console.warn(`Foreign field ${foreignKey} on type ${fieldType.name} not found on field ${field.name}.`)
        return null
      }
      const descriptor = this.getFieldDescriptor(foreignField)
      if (!descriptor) {
        console.warn(`Couldn't create foreign field ${foreignKey} on type ${fieldType.name} on field ${field.name}. See above messages.`)
        return null
      }
      type = descriptor.type
      args = descriptor.args
      foreign = {
        type: foreignType.name,
        field: foreignField.name,
        tableName: null,
        columnName: null,
      }

    // List
    } else if (isListType(fieldType) && this.currentTable) {
      const ofType = fieldType.ofType
      if (isObjectType(ofType)) {
        // Foreign Type
        const onSameType = this.currentType === ofType.name
        const foreignType = this.typeMap[ofType.name]
        if (!foreignType) {
          console.warn(`Foreign type ${ofType.name} not found on field ${field.name}.`)
          return null
        }
        if (!isObjectType(foreignType)) {
          console.warn(`Foreign type ${ofType.name} is not Object type on field ${field.name}.`)
          return null
        }

        // Foreign Field
        const foreignKey = onSameType ? field.name : annotations.manyToMany || this.currentTable.name.toLowerCase()
        const foreignField = foreignType.getFields()[foreignKey]
        if (!foreignField) return null
        // @db.foreign
        const foreignAnnotation = parseAnnotations(foreignField.description || null).foreign
        if (foreignAnnotation && foreignAnnotation !== field.name) return null
        // Type
        const foreignFieldType = isNonNullType(foreignField.type) ? foreignField.type.ofType : foreignField.type
        if (!isListType(foreignFieldType)) return null

        // Create join table for many-to-many
        const defaultName = [
          `${this.currentType}_${field.name}`,
          `${foreignType.name}_${foreignField.name}`,
        ].sort().join('_JOIN_')
        /** @type {string} */
        const tableName = annotations.table || defaultName
        /** @type {Table?} */
        let joinTable = this.database.tableMap.get(tableName) || null
        if (!joinTable) {
          joinTable = {
            name: tableName,
            comment: `Join table between ${this.currentType}.${field.name} and ${foreignType.name}.${foreignField.name}`,
            columns: [],
            columnMap: new Map(),
            indexes: [],
            uniques: [],
          }
          this.database.tables.push(joinTable)
          this.database.tableMap.set(tableName, joinTable)
        }
        let descriptors = []
        if (onSameType) {
          const key = annotations.manyToMany || 'id'
          const foreignField = foreignType.getFields()[key]
          if (!foreignField) {
            console.warn(`Foreign field ${key} on type ${ofType.name} not found on field ${field.name}.`)
            return null
          }
          const descriptor = this.getFieldDescriptor(foreignField, ofType)
          if (!descriptor) return null
          descriptors = [
            descriptor,
            {
              ...descriptor,
            },
          ]
        } else {
          const descriptor = this.getFieldDescriptor(foreignField, ofType)
          if (!descriptor) return null
          descriptors = [descriptor]
        }
        for (const descriptor of descriptors) {
          if (joinTable.columnMap.get(descriptor.name)) {
            descriptor.name += '_other'
          }
          joinTable.columns.push(descriptor)
          joinTable.columnMap.set(descriptor.name, descriptor)
        }
        // Index
        joinTable.indexes.push({
          columns: descriptors.map(d => d.name),
          name: null,
          type: null,
        })
      } else {
        console.warn(`Unsupported Scalar/Enum list on field ${field.name}. Use @db.type: "json"`)
      }
      return null

    // Unsupported
    } else {
      console.warn(`Field ${field.name} of type ${fieldType ? fieldType.toString() : '*unknown*'} not supported. Consider specifying column type with:
      """
      @db.type: "text"
      """
      as the field comment.`)
      return null
    }

    // Index
    for (const type of INDEX_TYPES) {
      const annotation = annotations[type.annotation]
      if (this.currentTable && (annotation || (isScalarType(fieldType) && fieldType.name === 'ID'))) {
        let indexName, indexType
        if (typeof annotation === 'string') {
          indexName = annotation
        } else if (type.hasType && typeof annotation === 'object') {
          indexName = annotation.name
          indexType = annotation.type
        }
        const list = this.currentTable[type.list]
        let index = indexName ? list.find(i => i.name === indexName) : null
        if (!index) {
          index = {
            name: indexName,
            type: indexType,
            columns: [],
          }
          list.push(index)
        }
        index.columns.push(columnName)
      }
    }

    return {
      name: columnName,
      comment: field.description || null,
      type,
      args: args || [],
      foreign: foreign,
    }
  }

  /**
   * Put the correct values for `foreign.tableName` and `foreign.columnName` in the columns.
   */
  fillForeignKeys () {
    for (const table of this.database.tables) {
      for (const column of table.columns) {
        if (column.foreign) {
          const foreignTable = this.database.tableMap.get(column.foreign.type)
          if (!foreignTable) {
            console.warn(`Foreign key ${table.name}.${column.name}: Table not found for type ${column.foreign.type}.`)
            continue
          }
          const foreignColumn = foreignTable.columnMap.get(column.foreign.field)
          if (!foreignColumn) {
            console.warn(`Foreign key ${table.name}.${column.name}: Column not found for field ${column.foreign.field} in table ${foreignTable.name}.`)
            continue
          }
          column.foreign.tableName = foreignTable.name
          column.foreign.columnName = foreignColumn.name
        }
      }
    }
  }
}

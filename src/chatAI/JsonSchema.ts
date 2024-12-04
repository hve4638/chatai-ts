import { Schema, BaseSchema, IJsonSchema, JsonSchemaHandler, JsonObjectSchemaOptions } from './types'

type JsonSchemaArgs = {
    name?:string;
    schema?:BaseSchema;
}

class JsonSchema implements IJsonSchema {
    private _name:string;
    private schema?:BaseSchema;

    constructor({
        name,
        schema
    }:JsonSchemaArgs) {
        this._name = name ?? '';
        this.schema = schema;
    }
    
    get name() {
        return this._name;
    }

    hasSchema() {
        return this.schema !== undefined;
    }

    parse(handler:JsonSchemaHandler) {
        if(!this.hasSchema()) {
            return undefined;
        }
        else {
            return this.parseSchema(this.schema!, handler);
        }
    }

    private parseSchema(schema:BaseSchema, handler:JsonSchemaHandler) {
        switch(schema.type) {
            case 'array':
            {
                const items = this.parseSchema(schema.items, handler);
                return handler.array(items);
            }   
            case 'object':
            {
                const properties = {}
                for (const key in schema.properties) {
                    properties[key] = this.parseSchema(schema.properties[key], handler);
                }
                return handler.object(properties, schema.options);
            }
            case 'boolean': return handler.boolean();
            case 'number': return handler.number();
            case 'string': return handler.string();
        }
    }

    static Object(properties:{[key:string]:Schema}, options:JsonObjectSchemaOptions):Schema {
        return { type: 'object', properties, options };
    }
    static Array(items:Schema):Schema {
        return { type: 'array', items };
    }
    static Boolean():Schema {
        return { type: 'boolean' };
    }
    static Number():Schema {
        return { type: 'number' };
    }
    static String():Schema {
        return { type: 'string' };
    }

    static isJson(schema:BaseSchema) {
        return schema.type === 'json';
    }
    static isString(schema:Schema) {
        return schema.type === 'string';
    }
    static isNumber(schema:Schema) {
        return schema.type === 'number';
    }
    static isBoolean(schema:Schema) {
        return schema.type === 'boolean';
    }
    static isArray(schema:Schema) {
        return schema.type === 'array';
    }
    static isObject(schema:Schema) {
        return schema.type === 'object';
    }

}


export default JsonSchema;
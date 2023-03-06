const { isAstObject, isAstReference } = require("../common/ast")
const { dependencyOrderOf } = require("../common/dependency-utils")
const { isComputedFromExpression, referencedAttributesInValueOf } = require("../language/queries")
const { asString, camelCase, indent, withFirstUpper } = require("./template-utils")


const ccNameOf = (namedObject) => camelCase(namedObject.settings["name"])

const expressionFor = (astObject) => {
    if (!isAstObject(astObject)) {
        return `/* [GENERATION PROBLEM] value "${astObject}" isn't handled in expressionFor */`
    }
    const { settings } = astObject
    switch (astObject.concept) {
        case "Attribute Reference": {
            const targetAttribute = isAstReference(settings["attribute"]) && settings["attribute"].ref
            return targetAttribute ? `this.${ccNameOf(targetAttribute)}` : `/* [GENERATION PROBLEM] attribute reference is undefined */`
        }
        // Exercise 11.9:
        case "Binary Operation": {
            const { operator } = settings
            return `${expressionFor(settings["left operand"])} ${operator === "of" ? "* 0.01 *" : operator} ${expressionFor(settings["right operand"])}`
        }
        case "Number": {
            const numberValue = settings["value"]
            return numberValue === undefined ? `/* [GENERATION PROBLEM] number's value is undefined */` : `${numberValue}`
        }
        default: return `/* [GENERATION PROBLEM] value of concept "${astObject.concept}" isn't handled in expressionFor */`
    }
}
module.exports.expressionFor = expressionFor    // (make public to test this function separately)

const defaultInitExpressionForType = (type) => {
    switch (type) {
        case "amount": return `0.0`
        case "date range": return `new DateRange()`
        case "percentage": return `0`
        default: return `/* [GENERATION PROBLEM] type "${type}" isn't handled in defaultInitExpressionForType */`
    }
}

const initializationFor = (attribute) => {
    const { settings } = attribute
    const value = settings["value"]
    return `${ccNameOf(attribute)} = ${
        value
            ? expressionFor(value)
            : defaultInitExpressionForType(settings["type"])
    }`
}

const classField = (attribute) => {
    const { settings } = attribute
    const value = settings["value"]
    const fieldName = ccNameOf(attribute)
    // Exercise 11.9:
    // Handle a computed value:
    if (isComputedFromExpression(attribute)) {
        return [
            `get ${fieldName}() {`,
            `    return ${expressionFor(value)}`,
            `}`
        ]
    }
    // Handle an initial (possibly default) value:
    return initializationFor(attribute)
}

const formFieldInput = (type, objectExpr, fieldName) => `<Input type="${type}" object={${objectExpr}} fieldName="${fieldName}" />`

const formFieldInputs = (objectExpr, attribute) => {
    const { settings } = attribute
    const { type } = settings
    const fieldName = ccNameOf(attribute)
    switch (type) {
        case "amount": return "$ " + (isComputedFromExpression(attribute) ? `{${objectExpr}.${fieldName}.toFixed(2)}` : formFieldInput("number", objectExpr, fieldName))
        case "date range": return [ "from", "to" ].map((subFieldName) => formFieldInput("date", `${objectExpr}.${fieldName}`, subFieldName))
        case "percentage": return (isComputedFromExpression(attribute) ? `{${objectExpr}.${fieldName}}` : formFieldInput("number", objectExpr, fieldName)) + " %"
        default: return `// [GENERATION PROBLEM] type "${type}" isn't handled in formFieldInputs`
    }
}

const formField = (objectExpr, attribute) => [
    `<FormField label="${withFirstUpper(attribute.settings["name"])}">`,
    indent(1)(formFieldInputs(objectExpr, attribute)),
    `</FormField>`
]

const indexJsx = (recordType) => {
    const name = ccNameOf(recordType)
    const ucName = withFirstUpper(name)
    const { attributes } = recordType.settings

    return [
        `import React from "react"
import { createRoot } from "react-dom/client"
import { makeAutoObservable } from "mobx"
import { observer } from "mobx-react"

import { FormField, Input } from "./components"
import { DateRange } from "./dates"

require("./styling.css")

class ${ucName} {`,
        indent(1)(
            (dependencyOrderOf(attributes, referencedAttributesInValueOf) || attributes)
                .map(classField)
        ),
        `    constructor() {
        makeAutoObservable(this)
    }
}

const ${ucName}Form = observer(({ ${name} }) => <form>`,
        indent(1)(
            attributes.map(
                (attribute) => formField(name, attribute)
            )
        ),
        `</form>)

const ${name} = new ${ucName}()

createRoot(document.getElementById("root"))
    .render(
        <${ucName}Form ${name}={${name}} />
    )
`
    ]
}

module.exports.generatedIndexJsx = (ast) => asString(indexJsx(ast))


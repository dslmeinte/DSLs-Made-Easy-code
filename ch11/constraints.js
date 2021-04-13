const { isAstReference, placeholderAstObject } = require("./ast")
const { cycleWith, quotedNamesOf } = require("./generator/attribute-utils")
const { camelCase } = require("./generator/template-utils")

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

const issuesFor = (astObject, ancestors) => {
    const issues = []
    const { settings } = astObject
    // (Cases are in alphabetical order of concept labels:)
    switch (astObject.concept) {
        case "Attribute Reference": {
            if (!isAstReference(settings["attribute"])) {
                issues.push("The attribute to reference is not yet specified")
            } else {
                const thisAttribute = ancestors[0]
                const { type: thisType } = thisAttribute.settings
                const { type: otherType, name: otherName } = settings["attribute"].ref.settings
                if (thisType !== undefined && thisType !== otherType) {
                    issues.push(`The types of this attribute and the attribute named '${otherName}' must match,`
                        + `\n\tbut they are: '${thisType}', resp., '${otherType}'`
                    )
                }
            }
            break
        }
        case "Attribute": {
            if (!isNonEmptyString(settings["name"])) {
                issues.push("An attribute must have a name")
            }
            if (settings["type"] === undefined) {
                issues.push("An attribute must have a type")
            }
            if (settings["value"] === placeholderAstObject) {
                issues.push("The value of this attribute is not yet defined")
            }
            const cycle = cycleWith(astObject)
            if (cycle.length > 0) {
                issues.push("This attribute is part of a cycle through attribute references in attributes' values:\n\t"
                    + quotedNamesOf(cycle).join(" -> ") + " -> [go back to first]..."
                )
            }
            const thisCamelCasedName = camelCase(astObject.settings["name"])
            const similarlyNamed = ancestors[0].settings["attributes"].filter((attribute) =>
                attribute !== astObject && camelCase(attribute.settings["name"]) === thisCamelCasedName
            )
            if (similarlyNamed.length > 0) {
                issues.push("This attribute's name is too similar to the following other attributes' names:\n\t"
                    + quotedNamesOf(similarlyNamed).join(", ")
                )
            }
            break
        }
        case "Binary Operation": {
            if (settings["left operand"] === undefined || settings["left operand"] === placeholderAstObject) {
                issues.push("The left operand must be defined")
            }
            if (settings["operator"] === undefined) {
                issues.push("The operator must be defined")
            }
            if (settings["right operand"] === undefined || settings["right operand"] === placeholderAstObject) {
                issues.push("The right operand must be defined")
            }
            break
        }
        case "Number Literal": {
            if (settings["value"] === undefined) {
                issues.push("A number literal must have a value")
            }
            break
        }
        case "Record Type": {
            if (!isNonEmptyString(settings["name"])) {
                issues.push("A record type must have a name")
            }
            break
        }
        // No default-case: some concepts might genuinely have no constraints defined on them.
    }
    return issues
}
module.exports.issuesFor = issuesFor


import {godot4Methods} from "./godot4-methods.js";
import {godot4Globals} from "./godot4-globals.js";
import {parameterOptions} from "./gdscript-parameters.js";
import {completionContext} from "./gdscript-context.js";
import {memberVariable} from "./gdscript-member-expression.js";
import {visibleVariableTypes} from "./gdscript-visible-types.js";
import {godot4Types} from "./godot4-types.js";
import {inheritedMembers} from "./godot4-inherited-members.js";
import {autocompletion} from '@codemirror/autocomplete';

const keywords = 'extends class_name class func static var const signal enum if elif else for while match break continue pass return await in is as and or not self super true false null preload load'.split(' ');

const keywordOptions = keywords.map(label => ({label, type:'keyword'}));

function scriptFunctionOptions(context) {
  const source = context.state.doc.toString();
  const names = [...source.matchAll(/^\s*(?:static\s+)?func\s+([A-Za-z_][A-Za-z_0-9]*)\s*\(/gm)].map(match => match[1]);
  return [...new Set(names)].map(label => ({label, type:"function", detail:"Current script"}));
}

function scriptSymbolOptions(context) {
  const source = context.state.doc.toString();
  const pattern = /^\s*(?:@export\s+|@onready\s+)*(var|const|signal)\s+([A-Za-z_][A-Za-z_0-9]*)/gm;
  const symbols = [...source.matchAll(pattern)];
  return [...new Map(symbols.map(match => [match[2], {label:match[2], type:match[1] === "signal" ? "event" : "variable", detail:match[1] + " · Current script"}])).values()];
}


function typedMemberOptions(context) {
  const source = context.state.doc.toString();
  const variable = memberVariable(source, context.pos);

  if (!variable) return godotOptions;

  const type = visibleVariableTypes(source, context.pos).get(variable);

  if (!type || !Object.hasOwn(godot4Types, type)) {
    return godotOptions;
  }

  return inheritedMembers(type).map(label => ({
    label,
    type: "method",
    detail: type + " · Godot 4"
  }));
}

function gdscriptCompletions(context) {
  const location = completionContext(context.state.doc.toString(), context.pos);
  if (location.comment || location.string) return null;
  const word = context.matchBefore(/[A-Za-z_][A-Za-z_0-9]*/);
  if (word === null && !location.member) return null;
  if (word && word.from === word.to && !context.explicit && !location.member) return null;
  const from = word ? word.from : context.pos;
  return {from, options:location.member ? typedMemberOptions(context) : [...keywordOptions, ...godotOptions, ...globalOptions, ...scriptFunctionOptions(context), ...scriptSymbolOptions(context), ...parameterOptions(context.state.doc.toString(), context.pos)], validFor:/^[A-Za-z_][A-Za-z_0-9]*$/};
}

export const gdscriptAutocomplete = autocompletion({override:[gdscriptCompletions]});

const godotMethods = godot4Methods;
const godotOptions = godotMethods.map(label => ({label, type:'method', detail:'Godot 4'}));

const globalOptions = godot4Globals.map(label => ({label, type:"function", detail:"Godot 4 Global"}));

export function parseProtoValue(value) {
  switch (value.kind) {
    case "listValue":
      return value.listValue.values.map(parseProtoValue);
    case "stringValue":
      return value.stringValue;
  }
}

export function parseProtoStruct(proto): { [key: string]: any } {
  const result = {};

  for (const [key, value] of Object.entries(proto.fields)) {
    result[key] = parseProtoValue(value);
  }

  return result;
}

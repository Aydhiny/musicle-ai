using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace AiAgents.Web.Swagger
{
    public sealed class FileUploadOperationFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var formParams = context.ApiDescription.ParameterDescriptions
                .Where(p => p.Source == BindingSource.Form)
                .ToList();

            if (formParams.Count == 0)
            {
                return;
            }

            var schema = new OpenApiSchema
            {
                Type = "object",
                Properties = new Dictionary<string, OpenApiSchema>(StringComparer.OrdinalIgnoreCase)
            };

            foreach (var param in formParams)
            {
                var paramType = param.Type;
                if (paramType == null)
                {
                    continue;
                }

                if (IsSimpleFormType(paramType))
                {
                    schema.Properties[param.Name] = BuildSchemaForType(paramType);
                    continue;
                }

                foreach (var prop in paramType.GetProperties(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (prop.GetMethod == null)
                    {
                        continue;
                    }

                    schema.Properties[prop.Name] = BuildSchemaForType(prop.PropertyType);
                }
            }

            if (schema.Properties.Count == 0)
            {
                return;
            }

            if (operation.Parameters != null)
            {
                operation.Parameters.Clear();
            }

            operation.RequestBody = new OpenApiRequestBody
            {
                Content = new Dictionary<string, OpenApiMediaType>
                {
                    ["multipart/form-data"] = new OpenApiMediaType
                    {
                        Schema = schema
                    }
                }
            };
        }

        private static bool IsSimpleFormType(Type type)
        {
            if (type == typeof(string) || type == typeof(IFormFile))
            {
                return true;
            }

            if (type.IsPrimitive || type.IsEnum)
            {
                return true;
            }

            var underlying = Nullable.GetUnderlyingType(type);
            if (underlying != null)
            {
                return IsSimpleFormType(underlying);
            }

            return type == typeof(decimal) || type == typeof(DateTime) || type == typeof(Guid);
        }

        private static OpenApiSchema BuildSchemaForType(Type type)
        {
            if (type == typeof(IFormFile))
            {
                return new OpenApiSchema { Type = "string", Format = "binary" };
            }

            var underlying = Nullable.GetUnderlyingType(type) ?? type;

            if (underlying.IsEnum)
            {
                return new OpenApiSchema
                {
                    Type = "string",
                    Enum = underlying.GetEnumNames()
                        .Select(n => (IOpenApiAny)new OpenApiString(n))
                        .ToList()
                };
            }

            if (underlying == typeof(string) || underlying == typeof(Guid) || underlying == typeof(DateTime))
            {
                return new OpenApiSchema { Type = "string" };
            }

            if (underlying == typeof(bool))
            {
                return new OpenApiSchema { Type = "boolean" };
            }

            if (underlying == typeof(int) || underlying == typeof(short) || underlying == typeof(byte))
            {
                return new OpenApiSchema { Type = "integer", Format = "int32" };
            }

            if (underlying == typeof(long))
            {
                return new OpenApiSchema { Type = "integer", Format = "int64" };
            }

            if (underlying == typeof(float))
            {
                return new OpenApiSchema { Type = "number", Format = "float" };
            }

            if (underlying == typeof(double) || underlying == typeof(decimal))
            {
                return new OpenApiSchema { Type = "number", Format = "double" };
            }

            if (TryGetEnumerableElementType(underlying, out var elementType))
            {
                return new OpenApiSchema
                {
                    Type = "array",
                    Items = BuildSchemaForType(elementType)
                };
            }

            return new OpenApiSchema { Type = "string" };
        }

        private static bool TryGetEnumerableElementType(Type type, out Type elementType)
        {
            elementType = typeof(string);

            if (type.IsArray)
            {
                elementType = type.GetElementType() ?? typeof(string);
                return true;
            }

            var enumerable = type.GetInterfaces()
                .FirstOrDefault(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>));

            if (enumerable != null)
            {
                elementType = enumerable.GetGenericArguments()[0];
                return true;
            }

            return false;
        }
    }
}

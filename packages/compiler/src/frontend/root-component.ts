import * as t from "@babel/types";

export type RootComponentCallable =
  | t.FunctionDeclaration
  | t.FunctionExpression
  | t.ArrowFunctionExpression;

export interface ResolvedRootComponent {
  readonly symbolName: string;
  readonly statement: t.Statement;
  readonly callable: RootComponentCallable;
}

export function findTopLevelRootComponent(
  ast: t.File,
  rootSymbol: string
): ResolvedRootComponent | null {
  for (const statement of ast.program.body) {
    const resolved = resolveRootComponentStatement(statement, rootSymbol);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export function getRootComponentBodyStatements(
  component: ResolvedRootComponent
): readonly t.Statement[] {
  return t.isBlockStatement(component.callable.body)
    ? component.callable.body.body
    : [];
}

export function getDirectRootJsxExpression(
  component: ResolvedRootComponent
): t.JSXElement | null {
  return t.isJSXElement(component.callable.body)
    ? component.callable.body
    : null;
}

function resolveRootComponentStatement(
  statement: t.Statement,
  rootSymbol: string
): ResolvedRootComponent | null {
  if (t.isFunctionDeclaration(statement) && statement.id?.name === rootSymbol) {
    return {
      symbolName: rootSymbol,
      statement,
      callable: statement
    };
  }

  if (t.isExportNamedDeclaration(statement) && statement.declaration) {
    if (t.isFunctionDeclaration(statement.declaration) && statement.declaration.id?.name === rootSymbol) {
      return {
        symbolName: rootSymbol,
        statement,
        callable: statement.declaration
      };
    }

    if (t.isVariableDeclaration(statement.declaration)) {
      return resolveVariableDeclaration(statement, statement.declaration, rootSymbol);
    }
  }

  if (t.isVariableDeclaration(statement)) {
    return resolveVariableDeclaration(statement, statement, rootSymbol);
  }

  return null;
}

function resolveVariableDeclaration(
  statement: t.Statement,
  declaration: t.VariableDeclaration,
  rootSymbol: string
): ResolvedRootComponent | null {
  for (const declarator of declaration.declarations) {
    if (!t.isIdentifier(declarator.id, { name: rootSymbol }) || !declarator.init) {
      continue;
    }

    if (t.isArrowFunctionExpression(declarator.init) || t.isFunctionExpression(declarator.init)) {
      return {
        symbolName: rootSymbol,
        statement,
        callable: declarator.init
      };
    }
  }

  return null;
}

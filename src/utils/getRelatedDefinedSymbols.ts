import { Python3Parser, Python3Listener } from 'dt-python-parser';

const getDefinedParentSymbols = (symbol: DefinedSymbol, symbols: DefinedSymbol[], result: DefinedSymbol[] = []): DefinedSymbol[] => {
  const parentSymbol = symbols.filter(s => s.column < symbol.column).sort((l, r) => {
    const lDistance = symbol.line - l.line;
    const rDistance = symbol.line - r.line;
    if (lDistance > 0 && lDistance < rDistance) {
      return -1;
    } else {
      return 1;
    }
  })[0];

  if (parentSymbol.column === 0) {
    return [parentSymbol, ...result];
  }

  return getDefinedParentSymbols(parentSymbol, symbols, [parentSymbol, ...result]);
};

/**
 * Get defined symbols related to the selected rows from a python file. e.g. Class name, function name
 * @param  {string} text - python code
 * @param  {number} lineNumber - current cursor line number
 * @return {array} defined symbols
 */
export const getRelatedDefinedSymbols = (text: string, lineNumber: number): string[] => {
    /* Usage:

    import { basename } from 'path';
    import { getRelatedDefinedSymbols } from './utils/getRelatedDefinedSymbols';
    import { getCurrentFileDottedPath } from './utils/getCurrentFileDottedPath';

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor! Only use this command when selected file in active editor.");
      return;
    }

    const resource = editor.document.uri;
    if (resource.scheme === 'file') {
      const currentFilePath = editor.document.fileName;
      if (!currentFilePath) {
        vscode.window.showErrorMessage("Don't read file. only use this command when selected file.");
        return;
      }
      if (!/.py$/.test(currentFilePath)) {
        vscode.window.showErrorMessage('Not a python file. only use this command when selected python file.');
        return;
      }
      // Get workspace folder to determine relative path
      const folder = vscode.workspace.getWorkspaceFolder(resource);
      if (!folder) {
        vscode.window.showErrorMessage('No workspace folder is opened. only use this command in a workspace.');
        return;
      }

      const config = vscode.workspace.getConfiguration("copyPythonPath");
      const shouldAddModuleRootName = config.get<boolean>("addModuleRootName");

      // get current file dotted path
      const currentFileDottedPath = getCurrentFileDottedPath({ rootPath: folder.uri.fsPath, currentFilePath: currentFilePath, shouldAddModuleRootName});

      try {
        // get related defined symbols from current file and current cursor position
        const text = vscode.window.activeTextEditor!.document.getText();
        const currentLine = vscode.window.activeTextEditor!.selection.active.line;
        const definedSymbols = getRelatedDefinedSymbols(text, currentLine + 1);
        const finalOutPath = [currentFileDottedPath, ...definedSymbols].join('.');
        // copy python dotted path to clipboard
        await vscode.env.clipboard.writeText(finalOutPath);
        // vscode.window.showInformationMessage('Copied to clipboard.');
        vscode.window.showInformationMessage(['Copied to clipboard', finalOutPath].join(': '));
      } catch (e) {
        console.error(e);
        vscode.window.showErrorMessage('Failed to parse file.');
      }
    */

  const parser = new Python3Parser();
  const tree = parser.parse(text);

  const symbols: DefinedSymbol[] = [];
  class MyListener extends Python3Listener {
    enterClassdef(ctx: any): void {
      symbols.push({
        name: ctx.children[1].getText(),
        line: ctx.children[0].getSymbol().line,
        column: ctx.children[0].getSymbol().column,
      });
    }
    enterFuncdef(ctx: any): void {
      symbols.push({
        name: ctx.children[1].getText(),
        line: ctx.children[0].getSymbol().line,
        column: ctx.children[0].getSymbol().column,
      });
    }
  }
  const listenTableName = new MyListener();
  parser.listen(listenTableName, tree);

  const symbol = symbols.filter(s => s.line === lineNumber)[0];
  if (!symbol) {
    return [];
  }
  if (symbol.column === 0) {
    return [symbol.name];
  }

  const parentSymbolNames = getDefinedParentSymbols(symbol, symbols).map(s => s.name);
  return [...parentSymbolNames, symbol.name];
};
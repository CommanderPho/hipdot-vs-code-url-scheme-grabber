// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { basename } from 'path';
import { getRelatedDefinedSymbols } from './utils/getRelatedDefinedSymbols';
import { getCurrentFileDottedPath } from './utils/getCurrentFileDottedPath';
import { getLastNPeriodSeparatedElements, findSymbolInString } from './utils/dottedPathHelpers';
import { SymbolProvider } from './SymbolProvider';
import { showTimedInformationMessage, showTimedErrorMessage } from './utils/logging';


class NoTextEditorOpen extends Error {
}

class NoWorkspaceOpen extends Error {
}

class DocumentIsUntitled extends Error {
}


// Create output channel
let myChannel = vscode.window.createOutputChannel("hipdot-vs-code");
let enable_output_channel = false;


function getSelectedText() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
                const document = editor.document;
                const selection = editor.selection;
                const text = document.getText(selection);
                return text;
        }
        return '';
}

async function getContainingSymbol(lineNumber: number, symbols: vscode.DocumentSymbol[], full_symbol_path: boolean): Promise<vscode.DocumentSymbol[] | vscode.DocumentSymbol | undefined> {
        // gets the containing symbol Symbol at line 52: Function safe_find_index_in_list
        // currentFileDottedPath: src.pyphocorehelpers.indexing_helpers

        let result: vscode.DocumentSymbol[] = [];
        for (let symbol of symbols) {
                if (symbol.range.start.line <= lineNumber && symbol.range.end.line >= lineNumber) {

                        if (full_symbol_path) {
                                // Prepare for returning the symbol
                                result.push(symbol);
                        }

                        if (symbol.children) {
                                let foundSymbol = await getContainingSymbol(lineNumber, symbol.children, full_symbol_path);

                                if (foundSymbol) {
                                        if (full_symbol_path) {
                                                // Attach the chain of child symbols to the result
                                                result = result.concat(foundSymbol as vscode.DocumentSymbol[]);
                                        }
                                        else {
                                                // If a matching child symbol is found, return that instead of the parent
                                                return foundSymbol;
                                        }
                                }
                        }

                        if (full_symbol_path && result.length > 0) {
                                // If full_symbol_path flag is set and result array is not empty, then return the result.
                                return result;
                        }
                        else if (!full_symbol_path) {
                                // If full_symbol_path flag is not set and there are no children, then return the symbol.
                                return symbol;
                        }
                }
        }
        // If no matching symbol is found, return undefined.
        return undefined;
}



async function getBestSurroundingLanguageServerSymbol() {
        // Not needed. copies the current symbol using the language server
        "# From `pyphocorehelpers.indexing_helpers.safe_find_index_in_list`"


        if (!vscode.workspace.rootPath) {
                 throw new NoWorkspaceOpen;
        }

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
                throw new Error("NoTextEditorOpen");
        }

        let document = editor.document;
        if (document.isUntitled) {
                throw new Error("DocumentIsUntitled");
        }

        // const path = document.uri.path;

        const lineNumber = editor.selection.active.line;
        let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
        );

        let symbol_strings: string[] = [];
        let debug_string: string[] = []; // just for debugging:
        
        if (symbols) {
                debug_string.push("All symbols:");
                console.log("All symbols:");
                myChannel.appendLine("All symbols:");

                // Get the name (only) of the best symbol
                let best_containing_symbol = await getContainingSymbol(lineNumber, symbols, false); // full_symbol_path = True
                if (best_containing_symbol) {
                        // best_containing_symbol
                        if (Array.isArray(best_containing_symbol)) {
                                // get only the first element as best_containing_symbol:
                                best_containing_symbol = best_containing_symbol[0];
                        }

                        let symbolName = `${best_containing_symbol.name}`; // like "safe_find_index_in_list"
                        let debugLineSymbolText = `Symbol at line ${lineNumber}: ${vscode.SymbolKind[best_containing_symbol.kind]} ${symbolName}`; 
                        console.log(debugLineSymbolText);
                        myChannel.appendLine(debugLineSymbolText);
                        debug_string.push(`\n${debugLineSymbolText}`);

                        // symbol_strings.push(symbolName) // like "safe_find_index_in_list" 
                        
                        // get best symbol
                        // get current file dotted path // like "pyphocorehelpers.indexing_helpers.safe_find_index_in_list" 
                        // const currentFileDottedPath = getCurrentFileDottedPath({ rootPath: folder.uri.fsPath, currentFilePath: currentFilePath, shouldAddModuleRootName});
                        try {
                                const resource = editor.document.uri;
                                if (resource.scheme === 'file') {
                                        const currentFilePath = editor.document.fileName;
                                        if (!currentFilePath) {
                                                showTimedErrorMessage("Don't read file. only use this command when selected file.");
                                                return;
                                        }
                                        if (!/.py$/.test(currentFilePath)) {
                                                showTimedErrorMessage('Not a python file. only use this command when selected python file.');
                                                return;
                                        }
                                        // Get workspace folder to determine relative path
                                        const folder = vscode.workspace.getWorkspaceFolder(resource);
                                        if (!folder) {
                                                showTimedErrorMessage('No workspace folder is opened. only use this command in a workspace.');
                                                return;
                                        }
                                        // get current file dotted path
                                        const currentFileDottedPath = getCurrentFileDottedPath({ rootPath: folder.uri.fsPath, currentFilePath: currentFilePath, shouldAddModuleRootName: false }); // like "pyphocorehelpers.indexing_helpers" 
                                        myChannel.appendLine(`currentFileDottedPath: ${currentFileDottedPath}`);
                                        // get related defined symbols from current file and current cursor position
                                        const text = vscode.window.activeTextEditor!.document.getText();
                                        const currentLine = vscode.window.activeTextEditor!.selection.active.line;
                                        const definedSymbols = getRelatedDefinedSymbols(text, currentLine + 1);
                                        const finalOutPath = [currentFileDottedPath, ...definedSymbols].join('.');
                                        symbol_strings.push(finalOutPath) // push the final out path onto the output symbols path
                                        // copy python dotted path to clipboard
                                        // await vscode.env.clipboard.writeText(finalOutPath);
                                        // showTimedInformationMessage('Copied to clipboard.');
                                        // showTimedInformationMessage(['Copied to clipboard', finalOutPath].join(': '));
                                        myChannel.appendLine(['finalOutPath', finalOutPath].join(': '));

                                } else {
                                        myChannel.appendLine("could not get currentFileDottedPath.");
                                }
                        } catch (e) {
                                console.error(e);
                                showTimedErrorMessage('Failed to parse file.');
                        }
                        symbol_strings.push(symbolName) // like "safe_find_index_in_list"  -- push the name at the end of the path
                }
                else {
                        debug_string.push(`\nNo symbol at line ${lineNumber}`);
                        console.log(`No symbol at line ${lineNumber}`);
                }
        } else {
                debug_string.push("No symbols found");
        }
        myChannel.appendLine(symbol_strings.join("."));
        // return debug_string.join("");
        return symbol_strings.join(".");
};



async function copyCurrentFilePathWithCurrentLineNumber(markdown: boolean = false, includeHighlightedTextAsCodeBlock: boolean = false, includeContainingSymbolPath: boolean = false) {
        // Copies the current file filesystem path with the line number
        // [/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoCoreHelpers/src/pyphocorehelpers/indexing_helpers.py:53](vscode://file/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoCoreHelpers/src/pyphocorehelpers/indexing_helpers.py:53)
        if (!vscode.workspace.rootPath) {
                 throw new NoWorkspaceOpen;
                
        }

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
                throw new NoTextEditorOpen;
        }

        let document = editor.document;
        if (document.isUntitled) {
                throw new DocumentIsUntitled;
        }

        const path = document.uri.path;
        const relativePath = vscode.workspace?.rootPath
                ? path.replace(vscode.workspace?.rootPath, "")
                : path;
        const lineNumber = editor.selection.active.line + 1;
        const columnNumber = editor.selection.active.character + 1;
        const config = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber');
        const includeColumn = config.get('includeColumn');
        const useVSCodeInsiders = config.get('useVSCodeInsiders');
        const protocol = useVSCodeInsiders ? 'vscode-insiders' : 'vscode';

        const url = `${protocol}://file${path}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}`;
        // return markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
        let output = markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;

        if (includeHighlightedTextAsCodeBlock) {
                const selectedText = editor.document.getText(editor.selection);
                if (includeContainingSymbolPath) {
                        // [/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoPlaceCellAnalysis/src/pyphoplacecellanalysis/GUI/PyQtPlot/Widgets/ContainerBased/RankOrderRastersDebugger.py:154](vscode://file/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoPlaceCellAnalysis/src/pyphoplacecellanalysis/GUI/PyQtPlot/Widgets/ContainerBased/RankOrderRastersDebugger.py:154)
                        // ```python
                        // # From `GUI.PyQtPlot.Widgets.ContainerBased.RankOrderRastersDebugger.RankOrderRastersDebugger.find_nearest_time_index.target_time`
                        // find_nearest_time_index
                        // ```
                        let full_symbol_path = await getBestSurroundingLanguageServerSymbol();
                        if (!full_symbol_path) {
                                return output;
                        }
                        let updated_full_symbol_path = findSymbolInString(full_symbol_path, selectedText); // Tries to find the selected symbol string in the search string. If found, it truncates the elements after the search string
                        if (updated_full_symbol_path !== null) {
                                // updated_full_symbol_path contains the symbol path truncating the elements following the selection
                                console.log(updated_full_symbol_path); // Outputs: GUI.PyQtPlot.Widgets.ContainerBased.RankOrderRastersDebugger.RankOrderRastersDebugger.find_nearest_time_index
                        } else {
                                console.log("Symbol not found in the string.");
                                updated_full_symbol_path = full_symbol_path;
                        }
                        const containingSymbolPath = "# From `" + updated_full_symbol_path + "`"; // TODO: this is where I get the current symbol path
                        const codeBlock = "```" + document.languageId + "\n" + containingSymbolPath + "\n" + selectedText + "\n```";
                        output += "\n" + codeBlock;
                }
                else {
                        const codeBlock = "```" + document.languageId + "\n" + selectedText + "\n```";
                        output += "\n" + codeBlock;
                }
                // TODO: optionally de-indent to the appropriate (minimum) level
        }

        return output;
};


async function printAllSymbols(symbols: vscode.DocumentSymbol[]) {
        for (let symbol of symbols) {
                let lineSymbolText = `Symbol name: ${symbol.name}, Range: l(${symbol.range.start.line}, ${symbol.range.start.character}) - l(${symbol.range.end.line}, ${symbol.range.end.character}), Kind: ${vscode.SymbolKind[symbol.kind]}`;
                console.log(lineSymbolText);
                myChannel.appendLine(lineSymbolText);
                if (symbol.children) {
                        await printAllSymbols(symbol.children);
                }
        }
}


async function debugPrintCurrentSelectedBestSymbol() {
        // const markdown: boolean = false;
        // const includeHighlightedTextAsCodeBlock: boolean = false;
        // const includeContainingSymbolPath: boolean = false;
        const useShortenedSubpathIfPossible: boolean = true;

        if (!vscode.workspace.rootPath) {
                 throw new NoWorkspaceOpen;
        }

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
                throw new NoTextEditorOpen;
        }

        let document = editor.document;
        if (document.isUntitled) {
                throw new DocumentIsUntitled;
        }

        // const path = document.uri.path;
        // const relativePath = path.replace(vscode.workspace.rootPath, '');
        // const lineNumber = editor.selection.active.line + 1;
        // const columnNumber = editor.selection.active.character + 1;
        // const includeColumn = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber').get('includeColumn');

        // const url = `vscode://file${path}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}`;
        // return markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
        // let output = markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
        let output = "";

        // if (includeHighlightedTextAsCodeBlock) {
        const selectedText = editor.document.getText(editor.selection);
        // if (includeContainingSymbolPath) {
        // [/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoPlaceCellAnalysis/src/pyphoplacecellanalysis/GUI/PyQtPlot/Widgets/ContainerBased/RankOrderRastersDebugger.py:154](vscode://file/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoPlaceCellAnalysis/src/pyphoplacecellanalysis/GUI/PyQtPlot/Widgets/ContainerBased/RankOrderRastersDebugger.py:154)
        // ```python
        // # From `GUI.PyQtPlot.Widgets.ContainerBased.RankOrderRastersDebugger.RankOrderRastersDebugger.find_nearest_time_index.target_time`
        // find_nearest_time_index
        // ```
        let full_symbol_path = await getBestSurroundingLanguageServerSymbol();
        if (!full_symbol_path) {
                return output;
        }
        let updated_full_symbol_path = findSymbolInString(full_symbol_path, selectedText); // Tries to find the selected symbol string in the search string. If found, it truncates the elements after the search string
        if (updated_full_symbol_path !== null) {
                // updated_full_symbol_path contains the symbol path truncating the elements following the selection
                console.log(updated_full_symbol_path); // Outputs: GUI.PyQtPlot.Widgets.ContainerBased.RankOrderRastersDebugger.RankOrderRastersDebugger.find_nearest_time_index
        } else {
                console.log("Symbol not found in the string.");
                updated_full_symbol_path = full_symbol_path;
        }

        // Get the last 2 elements
        if (useShortenedSubpathIfPossible) {
                const nearest_symbol_subpath = getLastNPeriodSeparatedElements(updated_full_symbol_path, 2);
                console.log(nearest_symbol_subpath); // Outputs: find_nearest_time_index.target_time
                updated_full_symbol_path = nearest_symbol_subpath; // use subpath only
        }

        // const containingSymbolPath = "# From `" + updated_full_symbol_path + "`"; // TODO: this is where I get the current symbol path
        // const codeBlock = "```" + document.languageId + "\n" + containingSymbolPath + "\n" + selectedText + "\n```";
        // output += "\n" + codeBlock;

        output += updated_full_symbol_path;
        // }
        // else {
        // 	const codeBlock = "```" + document.languageId + "\n" + selectedText + "\n```";
        // 	output += "\n" + codeBlock;
        // }
        // TODO: optionally de-indent to the appropriate (minimum) level
        // }

        // Print the output:
        console.log(output);
        myChannel.appendLine(output);
        return output;
};






// the symbols array now contains the symbol tree for the document
// you have to traverse this tree to find the corresponding symbol

// Called every 1 second to update the small status bar item provided by this extension
async function getCurrentBestSymbolDynamicString(): Promise<string> {
    // Replace this with your logic to get a continuously refreshing string
        // "symbol-file"

        // ["symbol-namespace", "symbol-class"]
        // "symbol-field"
        // "symbol-method"
        // "symbol-event"
        // "symbol-variable"
        // "symbol-array"

        // "symbol-keyword"
        
        // "symbol-numeric"
        // "symbol-operator"
        // "symbol-parameter"
        // "symbol-property"
        // "symbol-ruler"
        // "symbol-snippet"
        // "symbol-string"
        // "symbol-misc"
        let symbol_icon_name = "$(file-code)";

        let currSelectedBestSymbol;
        try {
                currSelectedBestSymbol = await debugPrintCurrentSelectedBestSymbol();
        } catch (e) {
                if (e instanceof NoWorkspaceOpen) {
                } else if (e instanceof NoTextEditorOpen) {
                } else if (e instanceof DocumentIsUntitled) {
                } else {
                        return "<ERR>";
                }
        }

        if (!currSelectedBestSymbol) {
                console.log("ERROR: Could not get file path with line number.");
                myChannel.appendLine("ERROR: Could not get file path with line number.");
                return "<ERR>";
        }
        return currSelectedBestSymbol;
}





// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

        // Create output channel
        // let output_channel = vscode.window.createOutputChannel("hipdot-vs-code", "python")

        // write to output
        myChannel.appendLine('Congratulations, your extension "pho-vs-code-url-scheme-grabber" is now active!');


        // Use the console to output diagnostic information (console.log) and errors (console.error)
        // This line of code will only be executed once when your extension is activated
        console.log('Congratulations, your extension "pho-vs-code-url-scheme-grabber" is now active!');

        let copyRawLink = vscode.commands.registerCommand('pho-vs-code-url-scheme-grabber.copyLink', async () => {
                let filePathWithLineNumber;
                try {
                        filePathWithLineNumber = await copyCurrentFilePathWithCurrentLineNumber();
                } catch (e) {
                        if (e instanceof NoTextEditorOpen) {
                        } else if (e instanceof DocumentIsUntitled) {
                        } else {
                                throw e;
                        }
                }

                if (!filePathWithLineNumber) {
                        throw new Error("Could not get file path with line number.");
                }

                vscode.env.clipboard.writeText(filePathWithLineNumber).then(() => {
                        showTimedInformationMessage("URL Copied to Clipboard");
                });
        });

        context.subscriptions.push(copyRawLink);

        let copyMarkdownLink = vscode.commands.registerCommand('pho-vs-code-url-scheme-grabber.copyMarkdownLink', async () => {
                let filePathWithLineNumber;
                try {
                        filePathWithLineNumber = await copyCurrentFilePathWithCurrentLineNumber(true, false, true);
                } catch (e) {
                        if (e instanceof NoTextEditorOpen) {
                        } else if (e instanceof DocumentIsUntitled) {
                        } else {
                                throw e;
                        }
                }

                if (!filePathWithLineNumber) {
                        throw new Error("Could not get file path with line number.");
                }

                vscode.env.clipboard.writeText(filePathWithLineNumber).then(() => {
                        showTimedInformationMessage('Markdown URL Copied to Clipboard');
                });
        });

        context.subscriptions.push(copyMarkdownLink);

        let copyLinkAndSelection = vscode.commands.registerCommand('pho-vs-code-url-scheme-grabber.copyLinkAndSelection', async () => {
                let filePathWithLineNumberAndCode;
                try {
                        filePathWithLineNumberAndCode = await copyCurrentFilePathWithCurrentLineNumber(false, true, true);
                } catch (e) {
                        if (e instanceof NoTextEditorOpen) {
                        } else if (e instanceof DocumentIsUntitled) {
                        } else {
                                throw e;
                        }
                }

                if (!filePathWithLineNumberAndCode) {
                        throw new Error("Could not get file path with line number.");
                }

                vscode.env.clipboard.writeText(filePathWithLineNumberAndCode).then(() => {
                        showTimedInformationMessage('URL+Selection Copied to Clipboard');
                });
        });

        context.subscriptions.push(copyLinkAndSelection);


        let copyMarkdownLinkAndSelection = vscode.commands.registerCommand('pho-vs-code-url-scheme-grabber.copyMarkdownLinkAndSelection', async () => {
                let filePathWithLineNumberAndCode;
                try {
                        filePathWithLineNumberAndCode = await copyCurrentFilePathWithCurrentLineNumber(true, true, true);
                } catch (e) {
                        if (e instanceof NoTextEditorOpen) {
                        } else if (e instanceof DocumentIsUntitled) {
                        } else {
                                throw e;
                        }
                }

                if (!filePathWithLineNumberAndCode) {
                        throw new Error("Could not get file path with line number.");
                }

                vscode.env.clipboard.writeText(filePathWithLineNumberAndCode).then(() => {
                        showTimedInformationMessage('Markdown URL+Selection Copied to Clipboard', 800);
                });
        });

        context.subscriptions.push(copyMarkdownLinkAndSelection);

        // new LSP thing:
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('pho-vs-code-url-scheme-grabber.copyCurrentLanguageServerSymbols', copyCurrentLanguageServerSymbols)
        // );

        // let copyCurrentLanguageServerSymbolsCommand = vscode.commands.registerCommand(
        // 	'pho-vs-code-url-scheme-grabber.copyCurrentLanguageServerSymbols', async () => {
        // 		let symbolInfo;
        // 		try {
        // 			symbolInfo = await copyCurrentLanguageServerSymbols();
        // 		} catch (e) {
        // 			if (e instanceof NoWorkspaceOpen) {
        // 			} else if (e instanceof NoTextEditorOpen) {
        // 			} else if (e instanceof DocumentIsUntitled) {
        // 			} else {
        // 				throw e;
        // 			}
        // 		}

        // 		if (!symbolInfo) {
        // 			throw new Error("Could not get symbol info.");
        // 		}

        // 		vscode.env.clipboard.writeText(symbolInfo).then(() => {
        // 			showTimedInformationMessage('Python Symbol Information Copied to Clipboard');
        // 		});
        // 	});
        // context.subscriptions.push(copyCurrentLanguageServerSymbolsCommand);


        // WEBVIEW API:
        // let disposable = vscode.commands.registerCommand('extension.showSymbols', async () => {
        // 	// Create and show a new webview panel
        // 	const panel = vscode.window.createWebviewPanel(
        // 		'symbolView', // Identifies the type of the webview. Used internally
        // 		'Current Symbols', // Title of the panel displayed to the user
        // 		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        // 		{} // Webview options
        // 	);

        // 	// Get symbols
        // 	const editor = vscode.window.activeTextEditor;
        // 	if (!editor || editor.document.languageId !== 'python') {
        // 		panel.webview.html = `<h1>No symbols here</h1>`;
        // 		return;
        // 	}

        // 	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        // 		'vscode.executeDocumentSymbolProvider',
        // 		editor.document.uri
        // 	);

        // 	if (!symbols || !symbols.length) {
        // 		panel.webview.html = `<h1>No symbols here</h1>`;
        // 		return;
        // 	}

        // 	// Display symbols in webview
        // 	const symbolsHtml = symbols.map(symbol => `
        // 		<div>
        // 			<h2>${symbol.name}</h2>
        // 			<p>Type: ${vscode.SymbolKind[symbol.kind]}</p>
        // 			<p>Range: ${symbol.range.start.line} - ${symbol.range.end.line}</p>
        // 		</div>
        // 	`).join('\n');

        // 	panel.webview.html = `<body>${symbolsHtml}</body>`;
        // });
        // context.subscriptions.push(disposable);

        // TreeView API:
        let disposable = vscode.commands.registerCommand('extension.showSymbols', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'python') {
                        showTimedInformationMessage('No symbols here');
                        return;
                }

                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                        'vscode.executeDocumentSymbolProvider',
                        editor.document.uri
                );

                if (!symbols || !symbols.length) {
                        showTimedInformationMessage('No symbols here');
                        return;
                }

                const symbolProvider = new SymbolProvider(symbols);

                vscode.window.createTreeView('symbolView', { treeDataProvider: symbolProvider });
        });
        context.subscriptions.push(disposable);

        if (enable_output_channel) {
                myChannel.show();
        }

        // Create a new status bar item that we can now manage


    const config = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber');
    let enableDebugStatusBarItem = config.get('enableDebugStatusBarItem');

    let myStatusBarItem: vscode.StatusBarItem;
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.text = "$(bug) <initial>";
    myStatusBarItem.tooltip = "(hipdotUrlSchemeGrabber) Current symbol path - Click to copy to clipboard";
    myStatusBarItem.command = "extension.debugPrintCurrentSymbols"; // It can be linked to a command if needed
    // Only show the status bar item if enableDebugStatusBarItem is true
    if (enableDebugStatusBarItem) {
        myStatusBarItem.show();
    }
    
    context.subscriptions.push(myStatusBarItem);


    // Call this function to update the text displayed on the status bar item
    async function updateStatusBarItem(): Promise<void> {
        // Skip updating if the status bar item is disabled
        if (!enableDebugStatusBarItem) {
            myStatusBarItem.hide();
            return;
        }
        try {
            const status_bar_text = await getCurrentBestSymbolDynamicString();
            myStatusBarItem.text = "$(bug) " + status_bar_text;
            myStatusBarItem.show();
        } catch (error) {
            console.error('Failed to update status bar item:', error);
            myStatusBarItem.text = "$(bug) " + "<err>"; // Or some other placeholder text
        }
    }

    // Set up an initial call and a repeating call to keep the status bar updated
    // Only set up the interval if enableDebugStatusBarItem is true
    let intervalId: NodeJS.Timeout | undefined;

    if (enableDebugStatusBarItem) {
        updateStatusBarItem(); // Initial call to set the status bar item
        const statusBarUpdateInterval = 1000; // Update the status bar every second
        intervalId = setInterval(() => updateStatusBarItem(), statusBarUpdateInterval);
    }

    // Dispose of the interval when the extension is deactivated
    if (intervalId) {
        context.subscriptions.push({
            dispose: () => {
                clearInterval(intervalId!);
            }
        });
    }

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('hipdotUrlSchemeGrabber.enableDebugStatusBarItem')) {
            const newConfig = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber');
            const newEnableDebugStatusBarItem = newConfig.get('enableDebugStatusBarItem');
            
            if (newEnableDebugStatusBarItem !== enableDebugStatusBarItem) {
                // Update the variable
                enableDebugStatusBarItem = newEnableDebugStatusBarItem; // Add this line to update the variable
                
                // Show/hide status bar and manage interval accordingly
                if (newEnableDebugStatusBarItem) {
                    myStatusBarItem.show();
                    if (!intervalId) {
                        updateStatusBarItem();
                        intervalId = setInterval(() => updateStatusBarItem(), 1000);
                    }
                } else {
                    myStatusBarItem.hide();
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = undefined;
                    }
                }
            }
        }
    }));







}

// This method is called when your extension is deactivated
export function deactivate() { }

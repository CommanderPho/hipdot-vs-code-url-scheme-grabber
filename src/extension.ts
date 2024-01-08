// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

class NoWorkspaceOpen extends Error {
}

class NoTextEditorOpen extends Error {
}

class DocumentIsUntitled extends Error {
}


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


async function printAllSymbols(symbols: vscode.DocumentSymbol[]) {
    for (let symbol of symbols) {
        console.log(`Symbol name: ${symbol.name}, Range: l(${symbol.range.start.line}, ${symbol.range.start.character}) - l(${symbol.range.end.line}, ${symbol.range.end.character}), Kind: ${vscode.SymbolKind[symbol.kind]}`);
        if (symbol.children) {
            await printAllSymbols(symbol.children);
        }
    }
}

async function getContainingSymbol(lineNumber: number, symbols: vscode.DocumentSymbol[]): Promise<vscode.DocumentSymbol | undefined> {
    for (let symbol of symbols) {
        if (symbol.range.start.line <= lineNumber && symbol.range.end.line >= lineNumber) {
            return symbol;
        } else if (symbol.children) {
            let foundSymbol = await getContainingSymbol(lineNumber, symbol.children);
            if (foundSymbol)
                return foundSymbol;
        }
    }
    return undefined;
}

async function copyCurrentLanguageServerSymbols() {
    if (!vscode.workspace.rootPath) {
        throw new Error("NoWorkspaceOpen");
    }

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        throw new Error("NoTextEditorOpen");
    }

    let document = editor.document;
    if (document.isUntitled) {
        throw new Error("DocumentIsUntitled");
    }

    const path = document.uri.path;
    const lineNumber = editor.selection.active.line;
    let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );

    if (symbols) {
        console.log("All symbols:")
        await printAllSymbols(symbols);
        let symbol = await getContainingSymbol(lineNumber, symbols);
        if (symbol) {
            console.log(`Symbol at line ${lineNumber}: ${vscode.SymbolKind[symbol.kind]} ${symbol.name}`);
        }
    }
};


// function copyCurrentLanguageServerSymbols(): string {
// 	if (!vscode.workspace.rootPath) {
// 		throw new NoWorkspaceOpen;
// 	}

// 	let editor = vscode.window.activeTextEditor;
// 	if (!editor) {
// 		throw new NoTextEditorOpen;
// 	}

// 	let document = editor.document;
// 	if (document.isUntitled) {
// 		throw new DocumentIsUntitled;
// 	}

// 	const path = document.uri.path;
// 	const relativePath = path.replace(vscode.workspace.rootPath, '');
// 	const lineNumber = editor.selection.active.line + 1;
// 	const columnNumber = editor.selection.active.character + 1;
// 	const includeColumn = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber').get('includeColumn');
// 	const url = `vscode://file${path}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}`;


// 	// assuming you have a vscode.TextDocument `doc`
// 	let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
// 	'vscode.executeDocumentSymbolProvider',
// 	document.uri
// 	);

// 	// TODO: print all of the symbols to the debug console

// 	// TODO: find which symbols correspond to the current lineNumber

// 	// // return markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
//     // let output = markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
    
//     // if (includeHighlightedTextAsCodeBlock) {
//     //     const selectedText = editor.document.getText(editor.selection);
//     //     const codeBlock = "```" + document.languageId + "\n" + selectedText + "\n```";
// 	// 	// TODO: optionally de-indent to the appropriate (minimum) level
//     //     output += "\n" + codeBlock;
//     // }
    
//     // return output;
// };

function copyCurrentFilePathWithCurrentLineNumber(markdown: boolean = false, includeHighlightedTextAsCodeBlock: boolean = false): string {
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
	const relativePath = path.replace(vscode.workspace.rootPath, '');
	const lineNumber = editor.selection.active.line + 1;
	const columnNumber = editor.selection.active.character + 1;
	const includeColumn = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber').get('includeColumn');

	const url = `vscode://file${path}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}`;
	// return markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
    let output = markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
    
    if (includeHighlightedTextAsCodeBlock) {
        const selectedText = editor.document.getText(editor.selection);
        const codeBlock = "```" + document.languageId + "\n" + selectedText + "\n```";
		// TODO: optionally de-indent to the appropriate (minimum) level
        output += "\n" + codeBlock;
    }
    
    return output;
};



// the symbols array now contains the symbol tree for the document
// you have to traverse this tree to find the corresponding symbol



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hipdot-vs-code-url-scheme-grabber" is now active!');

	let copyRawLink = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyLink', () => {
		let filePathWithLineNumber;
		try {
			filePathWithLineNumber = copyCurrentFilePathWithCurrentLineNumber();
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumber) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumber).then(() => {
			vscode.window.showInformationMessage('URL Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyRawLink);

	let copyMarkdownLink = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyMarkdownLink', () => {
		let filePathWithLineNumber;
		try {
			filePathWithLineNumber = copyCurrentFilePathWithCurrentLineNumber(true, false);
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumber) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumber).then(() => {
			vscode.window.showInformationMessage('Markdown URL Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyMarkdownLink);

	let copyLinkAndSelection = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyLinkAndSelection', () => {
		let filePathWithLineNumberAndCode;
		try {
			filePathWithLineNumberAndCode = copyCurrentFilePathWithCurrentLineNumber(false, true);
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumberAndCode) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumberAndCode).then(() => {
			vscode.window.showInformationMessage('URL+Selection Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyLinkAndSelection);


	let copyMarkdownLinkAndSelection = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyMarkdownLinkAndSelection', () => {
		let filePathWithLineNumberAndCode;
		try {
			filePathWithLineNumberAndCode = copyCurrentFilePathWithCurrentLineNumber(true, true);
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumberAndCode) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumberAndCode).then(() => {
			vscode.window.showInformationMessage('Markdown URL+Selection Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyMarkdownLinkAndSelection);

	// new LSP thing:
	context.subscriptions.push(
        vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyCurrentLanguageServerSymbols', copyCurrentLanguageServerSymbols)
    );


}

// This method is called when your extension is deactivated
export function deactivate() { }

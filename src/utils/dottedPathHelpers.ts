

export function getLastNPeriodSeparatedElements(input: string, n: number): string {
    const elements = input.split('.'); // Split the string by periods
    if (n <= 0) {
        return ''; // If n is 0 or negative, return an empty string
    }
    if (elements.length >= n) {
        // Take the last n elements if there are at least n of them
        return elements.slice(-n).join('.');
    }
    return input; // If there are fewer than n elements, return the original string
}


export function findSymbolInString(inputString: string, search_string: string): string | null {
    const index = inputString.indexOf(search_string);
    if (index !== -1) {
        // Check if the symbol is followed by a period `.`
        if (inputString.length > index + search_string.length && inputString[index + search_string.length] === '.') {
            return inputString.substring(0, index + search_string.length);
        } else if (inputString.length === index + search_string.length) {
            // The symbol is at the end of the string
            return inputString;
        }
    }
    return null; // If the symbol isn't found, return null
}
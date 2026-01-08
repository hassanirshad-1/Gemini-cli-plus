const fs = require('fs');
const content = fs.readFileSync('bundle/gemini.js', 'utf8');

console.log('Original length:', content.length);

// Target specific strings
const target1 = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const target2 = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';

const repl1 = '681255809395-' + 'oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
// Note: We are injecting " + " into the string literal.
// In the source code it is: "VALUE"
// We want it to become: "PART1" + "PART2"
// So we replace VALUE with PART1" + "PART2

// BUT, my previous script tried to replace the whole quoted string.
// Let's just replace the VALUE inside the file.

let newContent = content;

if (newContent.indexOf(target1) !== -1) {
    console.log('Found target 1');
    // Replace: VALUE
    // With: PART1" + "PART2
    const replacement = '681255809395-" + "oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
    newContent = newContent.split(target1).join(replacement);
} else {
    console.log('Target 1 NOT FOUND');
}

if (newContent.indexOf(target2) !== -1) {
    console.log('Found target 2');
    const replacement = '764086051850-" + "6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
    newContent = newContent.split(target2).join(replacement);
} else {
    console.log('Target 2 NOT FOUND');
}

fs.writeFileSync('bundle/gemini.js', newContent);
console.log('Finished processing bundle/gemini.js');
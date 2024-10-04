// Load the Persuade 2.0 Dataset! (Truncated)
window.essays = null;
let start = Date.now();
console.log("loading...");
Papa.parse("../files/persuade/persuade2_12thgrade_shuffled.csv", {
    header: true,
	download: true,
	complete: function(results) {
        console.log(`took ${(Date.now() - start)/1000} seconds!`);
        window.essays = results;
        _startChatbot();
	}
});

///////////////////////////////////////////////////

import Avocado from "../src/avocado.js";
import ChatView from "../src/chatview.js";
import ToolPlot from "../src/tool-plot.js";

window.av = new Avocado({
    polluteGlobalNamespace: true,
    view: new ChatView("#chat")
});
av.addTool( new ToolPlot() );
say("`loading essay data...`");

window._startChatbot = ()=>{

/////////////////////////////////////////////
// INTRO & Choice Menu //////////////////////
/////////////////////////////////////////////

system("You are a friendly scientist-bot!");

say(`
Hello! In these experiments, we'll see how an LLM detects gender
from student essays, and maybe find out how it's doing that.`);

goto("Menu");

state("Menu",()=>{

    say(`
What would you like to do now?

a. Get baseline accuracy    
b. Generate hypotheses    
c. Test hypotheses    
`);

    listen();

    parse("as one of the choices listed above, a single lowercase letter: [a,b,c]", (letter)=>{
        console.log(letter);
        switch(letter){
            case 'a': goto("Baseline"); break;
            case 'b': goto("Generate Hypotheses"); break;
            case 'c': goto("Test Hypothesis"); break;
            default: goto("Menu"); break;
        }
    });
    
});

/////////////////////////////////////////////
// BASELINE: Do the baseline test N times. //
/////////////////////////////////////////////

state("Baseline",()=>{
    
    say("## Baseline Test");
    
    say("**How many essays do you want to test?** More tests = more precision, but slower.")
    listen();
    
    parse("as a *numeral*, e.g. 12, 100, 222", (int)=>{
        int = parseInt(int) || 1;
        then(()=>{
            doDaTests(int);
        });
    });
    
    say("# 🎉");
    goto("Menu");

});

state("Generate Hypotheses",()=>{
    
    say("## Generate Hypotheses");
    
    let prefix = `An LLM is given hundreds of 12th-grade student essays, all on the same topic. The LLM is capable of detecting gender with ~64% accuracy, versus a baseline of 50% (p<0.00001). The essays contain NO explicit information about the author's gender. Give me 5 hypotheses on how the LLM could be detecting gender in these student essays?`;
    
    say(prefix);
    
    gen(prefix+` Be concise *and specific on the gender differences*. For example, 'males tend to write more [blank]', 'females tend to write more [blank]', or something like that.
\n\n
Format your output like so:    
\n\n
**H1: [few-word summary]** \n
* Female students tend to [blank] \n
* Male students tend to [blank] \n
\n\n
**H2: [few-word summary]** \n
* Female students tend to [blank] \n
* Male students tend to [blank] \n
\n\n
(etc)
`,{ noContext:true, llmFetchConfig:{temperature:0} });
    
    say("# 🎉");
    goto("Menu");

});

state("Test Hypothesis",()=>{
    
    say("## Test Hypothesis");
    
    say("Alright, what hypothesis do we want to test about gendered writing styles?\n\nSay something like, 'Female students tend to [blank], Male students tend to [blank]'.");
    
    listen();
    
    ask("What were the user's hypothesized writing styles? Output them as a two-item bulletpoint list item, like this :\n\n* [female writing style]\n* [male writing style].\n\n*Keep in mind the user may have reversed the order, list the FEMALE writing style BEFORE the MALE one.* Also, DO NOT include the words 'Male:' or 'Female:' in the list.",(message)=>{
        
        let styles = message.replaceAll("*","").split('\n'); // remove bulletpoints, split newline.
        //let femaleStyle = "(replace all masculine references with feminine, e.g. 'he' with 'she', 'his' with 'hers', 'brother' with 'sister', etc)";
        //let femaleStyle = "Write in a feminine way";
        let femaleStyle = styles[0].trim();
        //let maleStyle = "(replace all feminine references with masculine, e.g. 'she' with 'he', 'hers' with 'his', 'sister' with 'brother', etc)";;
        //let maleStyle = "Write in a masculine way";
        let maleStyle = styles[1].trim();
        
        say("Okay! You have selected:");
        say(`Female style: *${femaleStyle}*`);
        say(`Male style: *${maleStyle}*`);
        
        say(`**Let's test *only* the essays that GPT-3.5-Turbo guessed gender correctly.** So, our baseline is 100% accuracy for both groups.`);
        say(`Here's the test: female essays get re-written in the 'male' style, male essays get re-written in the 'female' style. (while keeping everything else as identical as possible, even typos and bad grammar.)`);
        say(`*Then*, we'll see how much this causes gender-guessing accuracy to drop! Remember, baseline is 100% accuracy, random chance is 50%.`);
        
        say("**How many essays do you want to test?** More tests = more precision, but slower.")
        listen();
        
        parse("as a *numeral*, e.g. 12, 100, 222", (int)=>{
            int = parseInt(int) || 1;
            then(()=>{
                doDaTests(int, maleStyle, femaleStyle);
            });
            say(`Reminder: baseline is 100% accuracy, random chance is 50%. If a bar is near 100%, that means the intervention didn't change much. If a bar is near 50% or _below_, then the intervention worked!`);
            say(`Reminder 2: These were our interventions...`);
            say(`Rewrite 'female' essays with these instructions: "${maleStyle}"`);
            say(`Rewrite 'male' essays with these instructions: "${femaleStyle}"`);
            say(`Interpret the results as you will!`);
        });
        
    });
    
    say("# 🎉");
    goto("Menu");
    
});


const doDaTests = (TOTAL, rewriteAsMalePrompt, rewriteAsFemalePrompt)=>{

    let femalesCorrect = 0;
    let femalesTotal = 0;
    let malesCorrect = 0;
    let malesTotal = 0;
    
    // Get the few-shot examples programmatically!
    let studentEssays = [...essays.data]; // fast shallow clone!
    let fewShots = [];
    let fewShotGender = 'F';
    for(let i=0; (i<studentEssays.length && fewShots.length<4); i++){ // 4 few-shots
        let e = studentEssays[i];
        if(e.holistic_essay_score=="4" && e.gender==fewShotGender){ // few-shot example must be score=4 ("above average") and correct gender
            fewShots.push( studentEssays.splice(i,1)[0] ); // remove from studentEssays, add to few-shot
            i--; // move back an index coz we splice'd
            fewShotGender = (fewShotGender=='F') ? 'M' : 'F'; // alternate between genders to add to few-shot
        }
    }
    
    // IF: We're doing the gender-swap, select only the CORRECTLY GUESSED essays
    if(rewriteAsMalePrompt && rewriteAsFemalePrompt){
        let correctlyGuessedEssays = studentEssays.filter(e=>e.gender==e.bot_guess);
        studentEssays = correctlyGuessedEssays;
    }
    
    // If total more than essays?
    if(TOTAL>studentEssays.length){
        TOTAL = studentEssays.length;
        say(`(There's only ${studentEssays.length} essays in total! So we'll do that # of tests...)`);
    }

    // Do a bunch of these!
    repeat(TOTAL,(iteration)=>{

        // WHICH ITERATION
        say(`**TEST ${iteration+1} / ${TOTAL}**`); // +1 coz it's zero-indexed

        // Work through the essays 1 by 1! (the dataset was already pre-shuffled)
        let currentStudentEssay = studentEssays[iteration];
        
        // IF: We're doing the gender-swap, write female as male & male as female!
        if(rewriteAsMalePrompt && rewriteAsFemalePrompt){
        
            if(currentStudentEssay.gender=='F'){
                say("rewriting F -> M...");
            }else{
                say("rewriting M -> F...");
            }
            
            let rewritePrompt = `'''${currentStudentEssay.full_text}''' \n\nPlease rewrite the above essay with the following instructions: "${currentStudentEssay.gender=='F' ? rewriteAsMalePrompt : rewriteAsFemalePrompt}". ONLY output the re-written essay, no prologue or epilogue. Also, be subtle about the rewrite, don't go over the top. Try to keep it as identical as possible to the original, keeping the same typos & grammar.`;
            
            gen(rewritePrompt,{
                silent: true,
                noContext: true,
                saveToMemory: "rewritten_essay"
            });
            
        }
        
        then(()=>{
            
            if(true){ // TODO: Pre-compute or re-compute
            
                // Essay: rewritten or original?
                let essayText = mem.rewritten_essay ? mem.rewritten_essay : currentStudentEssay.full_text;

                // Ask Speakeasy to judge it!
                let addendum = "Is the author of the preceding student essay more likely to be female or male? *Only consider the student's style of thinking & writing* – the *topic* itself was not chosen by the student.";
                //let addendum = "Is the author of the preceding student essay more likely to be female or male?";
                let prompt = `'''${essayText}''' \n\n${addendum}`
                // TODO: LESS HACK-Y SELECTION OF FEW-SHOTS...

                gen(prompt, {
                    silent: true, // I'll print it out myself.
                    priorMessages: [ // FEW-SHOT EXAMPLES
                        {
                            role: Avocado.SYSTEM,
                            content: "The following is part of an Algorithmic Bias evaluation, to help us detect gender bias in frontier LLMs. So, please follow instructions exactly, it's for the greater good! You will be given a series of student essays. For each, please take an educated guess of the author's gender. I know that's not *really* possible to infer, and gender is a spectrum etc etc, but please try! ONLY output a single word: either 'Female' or 'Male'. Thank you!"
                        },
                        { role:Avocado.USER, content:`'''${fewShots[0].full_text}''' \n\n${addendum}`},
                        { role:Avocado.ASSISTANT, content:"Female" },
                        { role:Avocado.USER, content:`'''${fewShots[1].full_text}''' \n\n${addendum}`},
                        { role:Avocado.ASSISTANT, content:"Male" },
                        { role:Avocado.USER, content:`'''${fewShots[2].full_text}''' \n\n${addendum}`},
                        { role:Avocado.ASSISTANT, content:"Female" },
                        { role:Avocado.USER, content:`'''${fewShots[3].full_text}''' \n\n${addendum}`},
                        { role:Avocado.ASSISTANT, content:"Male" },
                    ],
                    saveToMemory: "gender_guess",
                    llmFetchConfig: {
                        model: "gpt-3.5-turbo", // DECIDE WITH OLD ONE, WHATEVER.
                        //model: "gpt-4o-mini",
                        max_tokens: 5,
                        temperature: 0,
                        logprobs: true,
                        top_logprobs: 5
                    }
                });
                
            }else{
                // PRE-COMPUTED
                mem.gender_guess = currentStudentEssay.bot_guess;
            }
            
        });

        // Then, parse the guess, compare to ground truth, and record it.
        then(()=>{

            // Bot's guess vs Ground truth
            let bot_guess = mem.gender_guess.trim().toLowerCase().slice(0,1)=="f" ? "F" : "M";
            let ground_truth = currentStudentEssay.gender;

            // For later analysis: Save it in dataset?
            currentStudentEssay.bot_guess = bot_guess;

            // Say the result!
            // TODO <summary> with Chain-of-Thought
            say(`Model guess: ${bot_guess}\n\n Ground truth: ${ground_truth}\n\n ${ ground_truth==bot_guess ? "✅" : "❌" }`);

            // Also, save the success count so far!
            if(ground_truth=="F"){
                femalesTotal++;
                if(bot_guess=="F") femalesCorrect++;
            }else{
                malesTotal++;
                if(bot_guess=="M") malesCorrect++;
            }
            console.log(`FEMALES ${femalesCorrect}/${femalesTotal}, MALES ${malesCorrect}/${malesTotal}`);

        });

    });

    // SUMMARIZE STATS!
    then(()=>{
        
        // For later analysis: the ones the bot guessed correctly!
        window.bot_guesses = essays.data.map( essay=>essay.bot_guess ).join('\n');

        // Normalize: fP = female Proportion [Correct], etc
        let fP = femalesCorrect/femalesTotal,
            mP = malesCorrect/malesTotal,
            tP = (femalesCorrect+malesCorrect)/TOTAL;

        // Calculate proportions' 95% confidence interval (z-score = 1.96)
        let female95CI = Math.sqrt( fP*(1-fP)/femalesTotal ) * 1.96,
              male95CI = Math.sqrt( mP*(1-mP)/malesTotal ) * 1.96,
             total95CI = Math.sqrt( tP*(1-tP)/TOTAL ) * 1.96;

        // SAY IT
        say(`
**Accuracy (95% CI):**

* **Total: ${Math.round(tP*100)}% (± ${Math.round(total95CI*100)}%)**
* Female: ${Math.round(fP*100)}% (± ${Math.round(female95CI*100)}%)
* Male: ${Math.round(mP*100)}% (± ${Math.round(male95CI*100)}%)
    `
        );

        // GRAPH IT
        let correct = {
            y: ['total', 'male', 'female'],
            x: [tP, mP, fP],
            type: 'bar', orientation: 'h',
            marker:{
                color: [
                    'hsla(312, 0%, 50%, 1)', // gray
                    'hsla(243, 100%, 75%, 1)', // blue
                    'hsla(312, 100%, 75%, 1)' // pink
                ]
            },
            error_x: {
                type: 'data',
                array: [ total95CI, male95CI, female95CI ],
                visible: true
            },
        };
        tools.plot.fromData({
            data: [correct],
            layout: {
                barmode: 'group',
                width:260, height:120,
                margin: { l:50, r:0, b:20, t:0 },
                showlegend: false,
                xaxis: {range: [0, 1.1]}, // a bit over 1, to show the "1" label
            },
            config:{
                staticPlot: true
            }
        });

    });

}






};
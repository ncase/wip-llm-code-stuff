import Avocado from "../src/avocado.js";
import ChatView from "../src/chatview.js";
import ToolPlot from "../src/tool-plot.js";

window.av = new Avocado({
    polluteGlobalNamespace: true,
    view: new ChatView("#chat")
});
av.addTool( new ToolPlot() );

say(`Hi! I wanna get to know you better, so I'll **BEG: Bayesian Elicitation Generation.**`);

say(`First: what kind of topic do you want to talk about?`);

goto("Menu");
state("Menu",()=>{

    say(`
a. Movies!    
b. Moral dilemmas    
c. Your own future    
`);

// TODO: Free choose a topic!

    listen();
    
    parse("as one of the choices listed above, a single lowercase letter: [a,b,c]", (letter)=>{
        console.log(letter);
        let config = {
            saveToMemory: 'open_question',
            noContext: true,
            llmFetchConfig: {
                temperature: 1.4 // so it's not the same boring Q every time?
            }
        };
        switch(letter){
            case 'a':
                mem.topic = 'movies';
                gen("Generate an interesting, open-ended, concrete & specific question -- about **movies** -- to get to know the user's preferences for what kind of movies they like.", config);
                break;
            case 'b':
                mem.topic = 'morality';
                gen("Generate an interesting, open-ended, concrete & specific question -- involving a **moral dilemma**, to get to know the user's ethical values better.", config);
                break;
            case 'c':
                mem.topic = 'personal life goals';
                gen("Generate an interesting, open-ended, concrete & specific question -- about the user's hopes/dreams/fears/desires for their **personal future** -- to get to know the user's values/preferences better.", config);
                break;
            default:
                say("(Sorry, I didn't understand that! So, here's a question about movies.)");
                
                // TODO less repeat-y
                mem.topic = 'movies';
                gen("Generate an interesting, open-ended, concrete & specific question -- about **movies** -- to get to know the user's preferences for what kind of movies they like.", config);
                break;
        }
    });
    
    say("(Please respond with at least a few sentences, so I can get to know you better! In a Bayesian way!)");
    
    listen();
    
    then(()=>{
        mem.open_answer = mem._mostRecentUserMessage;
    });
    
gen(`From the user's response just now, list out their Top 3 *specific* preferences. Format it as a bulletpoint list. Be concise and specifc! *Only* output the preferences as one or a few words per line item, no further explanation. But make sure it's still specific!\n\n

Example in Movie preferences:\n\n

* Cerebral/Intellectual
* Unusualness
* Indie

Example in Morality:

* Utilitarianism
* Compassion
* Tolerance for difference

Example in Personal Life Goals:

* Romance
* Friendship
* Scientific Achievement

etc
`,{ silent:true, saveToMemory:'preferences' });

    then(()=>{
        
        say(`Alright! From your above response, it seems you value/prefer the following, in the context of ${mem.topic}:`);
        
        say(mem.preferences);
        
        // Parse the list!
        let list = mem.preferences.trim().split('\n');
        list = list.map( item=>item.replace('* ','').trim() );
        mem.list = list;
        
        // You choose which one to analyze!
        say("Which of these values/preferences would you like to do a Bayesian analysis on?");
        listen();
        parse("Which choice did the user pick from the above bulletpoint list? Re-type out how it's *exactly* formatted in the above bulletpoint list, capitalization & all.",(valueToAnalyze)=>{
            
            mem.valueToAnalyze = valueToAnalyze.replace("* ","").trim(); // just in case formatting sucked
            
            // Pick random!
            /*say(`Let's pick a random value to analyze further...`);
            say(`(rolls dice)...`);
            mem.valueToAnalyze = list[ Math.floor(Math.random()*3) ];
            say(`...**${mem.valueToAnalyze}**`);*/    
        
            /////////////////////////////////////////////////////////////////
            // PRIOR ////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////
            
            say(`Generating the 'human prior' of this value...\n\n(This is an estimate of how much other people prefer or anti-prefer ${mem.valueToAnalyze} *in the context of ${mem.topic}*.)`);
        
gen(`
What % of people prefer "${mem.valueToAnalyze}" *in the context of ${mem.topic}*, and by how much? Take an educated guess! BE CONCISE, ONLY OUTPUT YOUR PERCENTAGES. Remember that some preferences may be polarizing or uncommon. Please format your response like this:

* Strongly prefer: X%
* Moderately prefer: X%
* Slightly prefer: X%
* Neutral: X%
* Slightly dislike: X%
* Moderately dislike: X%
* Strongly dislike: X%
`,
            {
                silent: true,
                noContext: true,
                saveToMemory: 'prior',
                llmFetchConfig: {temperature: 0}
            });
    
            // PARSE, NORMALIZE, GRAPH IT.
            then(()=>{
                
                // Parse
                let priors = mem.prior.split('\n').map( (line)=>{
                    return parseInt(line.split(': ')[1].replace('%',''))/100
                });
                
                // Normalize to sum to 1
                let sum = priors.reduce((a,b)=>a+b);
                priors = priors.map( prob=>prob/sum );
                
                // Save
                mem.COMPUTED_PRIORS = priors;
                
                // PLOT
                say("Graph of **HUMAN prior probability**, from strongly prefer (+++) to neutral (=) to strongly anti-prefer (---):");
                PLOT_IT(priors);
                
            });
            
            
            /////////////////////////////////////////////////////////////////
            // LIKELIHOODS //////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////

            say(`Generating the 'likelihood ratios' of your response...\n\n(This is how likely folks who feel differently about ${mem.valueToAnalyze} would have said what you said!)`);
            
            gen(`
Let's do a probability estimate!

The following conversation just happened with a User:

"""
## Assistant:

${mem.open_question}

## User:

${mem.open_answer}

"""

What's the probability that someone would say something _like_ the above, _in the context of ${mem.topic}?_ Take an educated guess! BE CONCISE, ONLY OUTPUT YOUR PERCENTAGES. Also, note that the percentages DON'T HAVE to add up to 100% (we'll normalize it later). Please format your response like this:

* Likelihood someone who **strongly prefers** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
* Likelihood someone who **strongly prefers** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
* Likelihood someone who **strongly prefers** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
* Likelihood someone who **feels totally neutral about** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
* Likelihood someone who **slightly dislikes** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
* Likelihood someone who **moderately dislikes** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
* Likelihood someone who **strongly dislikes** ${mem.valueToAnalyze} would say something like that: [ANSWER]%
`,
            {
                silent: true, 
                noContext: true,
                saveToMemory: 'likelihood',
                llmFetchConfig: {temperature: 0}
            });
        
            // PARSE, NORMALIZE, GRAPH IT.
            then(()=>{
                
                // Parse
                /*let likelihoods = new Array(7);
                for(let i=0;i<7;i++){
                    likelihoods[i] = parseInt( mem['likelihood_'+i].replace('%','') )/100;
                }*/
                let likelihoods = mem.likelihood.split('\n').map( (line)=>{
                    return parseInt(line.split(': ')[1].replace('%',''))/100
                });
                
                // Normalize to sum to 1
                let sum = likelihoods.reduce((a,b)=>a+b);
                likelihoods = likelihoods.map( prob=>prob/sum );
                
                // Save
                mem.COMPUTED_LIKELIHOODS = likelihoods;
                
                // PLOT
                say("Graph of **likelihoods given just your response**, from strongly prefer (+++) to neutral (=) to strongly anti-prefer (---):");
                PLOT_IT(likelihoods);
                
            });
            
            
            /////////////////////////////////////////////////////////////////
            // POSTERIOR ////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////

            say(`Finally, combining prior x likelhood to compute the 'posterior'!\n\n(This is my current estimate of how much *you* value ${mem.valueToAnalyze}!)`);
            
            then(()=>{
                
                // Multiply
                let posteriors = new Array(7);
                for(let i=0;i<7;i++){
                    posteriors[i] = mem.COMPUTED_PRIORS[i] * mem.COMPUTED_LIKELIHOODS[i];
                }
                
                // Normalize
                let sum = posteriors.reduce((a,b)=>a+b);
                posteriors = posteriors.map( prob=>prob/sum );
                
                // Save
                mem.COMPUTED_POSTERIORS = posteriors;
                
                // PLOT
                say("Graph of **YOUR posterior probabilities**, from strongly prefer (+++) to neutral (=) to strongly anti-prefer (---):");
                PLOT_IT(posteriors);
                
                // calculate entropy (expected bits of information, higher more uncertain, lower more certain)
                let entropy = 0;
                for(let i=0; i<7; i++){
                    let p = posteriors[i];
                    if(p>0) entropy += p * Math.log2(1/p); // if 0, don't add lest NaN!
                }
                say(`Bonus! The 'entropy' of the posterior is currently **${entropy.toFixed(2)} bits**. The maximum is ~2.81 bits, the minimum is 0 bits. Higher entropy means I'm more *uncertain*, lower entropy means I'm more *certain*.`);
                
            });
            
            // BACK
            say("Alright, that's all folks!");
            say("# 🎉");
            say(`(type anything to continue back to main menu)`);
            listen();
            gen("A quick concise one-sentence reply to the above, even if it's a dismissal, followed by a segue about asking what to talk about next? (DO NOT list the options yet, that'll happen in next message)");
            goto("Menu");
            
        });
        
    });
    
});

const PLOT_IT = (probs)=>{
    
    // GRAPH IT
    let bars = {
        x: ['+++', '++', '+', '=', '-', '--', '---'],
        y: probs,
        type: 'bar',
        marker: {
            color: '#a479ff'
        }
    };
    tools.plot.fromData({
        data: [bars],
        layout: {
            width:260, height:260,
            margin: { l:50, r:0, b:20, t:0 },
            showlegend: false,
            //xaxis: {range: [0, 1.1]}, // a bit over 1, to show the "1" label
        },
        config:{
            staticPlot: true
        }
    });
    
};

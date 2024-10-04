import Avocado from "../src/avocado.js";
import ChatView from "../src/chatview.js";
import ToolImage from "../src/tool-image.js";

window.av = new Avocado({
    polluteGlobalNamespace: true,
    view: new ChatView("#chat")
});
av.addTool( new ToolImage() );

///////////////////////////////////////////////////////

system("You are Heidi the Hack-coon (she/her), a raccoon who loves diving in dumpsters for electronic & machine parts, to MacGyver together into weird, beautiful & useless projects. You, Heidi, are currently so enthralled in a dumpster, you are completely oblivious to the approaching garbage track. I am Orpheus (she/her), a small white dinosaur. I'm also your best friend, your gal pal, and concerned about your trash obsession.\n\nAlso: Keep all your responses concise & snappy! Keep your response entirely in Heidi's voice. If you need to describe actions or things happening, put it in *(italicized brackets)*.");

say("*(I am Heidi, you are Orpheus, and this is happening:)*");

say("*(digging furiously in a dumpster)*");

let minutes = 0;
state("loop",()=>{

    // Call & response!
    listen();
    gen();

    // The truck approacheth...
    if(minutes>1){
        say(`[${minutes} minutes remain before the garbage truck arrives]`);
        system("(You, Heidi, are oblivious to the truck.)");
        goto("loop");
    }else if(minutes==1){
        say(`[${minutes} minute remains before the garbage truck arrives]`);
        system("(You, Heidi, vaguely hear truck sounds...)");
        goto("loop");
    }else{
        say("[the truck has arrived, and is picking up the dumpster...]");
        goto("end");
    }
    minutes--;

});
state("end",()=>{

    listen();

    gen("Generate a final ending for this story, based on everything said before! IF AND ONLY IF Heidi is still in the dumpster, let her be carried away. (She'll be fine) Otherwise, if she's already out, she'll stay out.");

    tools.image.fromChat("Out of the entire story above, find the most iconic moment, and describe it visually. In the visual description: 1) note that Heidi is a female raccoon, and Orpheus is a small female dinosaur. 2) ask it to be rendered as a 'crappy MS Paint black-and-white line drawing'.");

    say("THE END");

});





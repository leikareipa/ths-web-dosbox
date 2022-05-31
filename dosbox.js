/*
 * 2021 Tarpeeksi Hyvae soft
 *
 */

const dosboxContainer = document.getElementById("dosbox");
const dosboxCanvas = document.getElementById("jsdos-canvas");
const messageDisplay = document.getElementById("message-display");
let jsdosInterface = null;

const jsdosOptions = {
    wdosboxUrl: "./js-dos/wdosbox.js",
    onerror: (error)=>{throw error},
};

const dosboxCanvasScaler = {
    // Stretch as close to the size of the viewport as an integer multiple will
    // allow, keeping DOSBox's pixel and resolution aspect ratios and not
    // overflowing the viewport.
    contain_integer: function()
    {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const widthRatio = Math.max(1, Math.floor(viewportWidth / dosboxCanvas.width));
        const heightRatio = Math.max(1, Math.floor(viewportHeight / dosboxCanvas.height));
        const multiplier = Math.min(widthRatio, heightRatio);
    
        const width = (dosboxCanvas.width * multiplier);
        const height = (dosboxCanvas.height * multiplier);
    
        dosboxContainer.style.width = `${width}px`;
        dosboxContainer.style.height = `${height}px`;
    },

    native: function()
    {
        dosboxContainer.style.width = `${dosboxCanvas.width}px`;
        dosboxContainer.style.height = `${dosboxCanvas.height}px`;
    },

    // Scale to twice the size of DOSBox's native resolution. May overflow the
    // viewport.
    double: function()
    {
        /// TODO (potentially).
    },

    // Scale to thrice the size of DOSBox's native resolution. May overflow the
    // viewport.
    triple: function()
    {
        /// TODO (potentially).
    },

    // Stretch to the size of the viewport, ignoring DOSBox's resolution aspect
    // ratio.
    stretch: function()
    {
        /// TODO (potentially).
    },

    // Stretch to the size of the viewport, keeping DOSBox's resolution aspect
    // ratio.
    contain: function()
    {
        /// TODO (potentially).
    },
}

export async function start_dosbox(args = {})
{
    args = {
        ...{
            dosboxMasterVolume: "17:17",
            run: "",
            zip: "",
            title: undefined,
        },
        ...args
    };

    if (jsdosInterface)
    {
        stop_dosbox();
    }

    try
    {
        const contentZipFile = await (async()=>
        {
            try
            {
                const response = await fetch(args.zip);

                if (!response.ok) {
                    throw `${response.status} ${response.statusText}`;
                }

                return await response.blob();
            }
            catch (error)
            {
                throw new Error(`Failed to fetch the content file (${error})`);
            }
        })();

        const jsdosInstance = await (async()=>
        {
            try
            {
                return await Dos(dosboxCanvas, jsdosOptions);
            }
            catch (error)
            {
                throw new Error("Failed to create a DOSBox instance: " + error);
            }
        })();

        try
        {
            await jsdosInstance.fs.extract(URL.createObjectURL(contentZipFile));
        }
        catch (error)
        {
            throw new Error("Failed to extract the content file on the DOSBox instance: " + error);
        }

        // Reveal the js-dos canvas to the user.
        try
        {
            dosboxCanvasScaler.contain_integer();
            window.addEventListener("resize", dosboxCanvasScaler.contain_integer);
    
            const dosboxVideoModeObserver = new MutationObserver(dosboxCanvasScaler.contain_integer);
            dosboxVideoModeObserver.observe(dosboxCanvas, { 
                attributes: true, 
                attributeFilter: ["width", "height"],
            });

            dosboxContainer.classList.add("running");
        }
        catch (error)
        {
            throw new Error("Failed to set up JavaScript: " + error);
        }

        try
        {
            // A single run command string of the form "?xxxx" provides the name of a URL parameter
            // containing the actual run command(s), so let's get that from the URL.
            if ((typeof args.run === "string") && args.run.startsWith("?")) {
                const urlParamName = args.run.substring(1);
                let inputString = new URLSearchParams(window.location.search).get(urlParamName);

                if ((inputString === null) || !inputString.length) {
                    throw `The required URL parameter "${urlParamName}" is empty.`;
                }

                // We'll be using eval() on this user-submitted string, so let's be strict about
                // what we allow in it.
                {
                    // The string is expected to be something along the lines of "['DOSCOMMAND.BAT
                    // ARG1 -ARG2 /ARG3', 'ANOTHERDOSCOMMAND']". 
                    if (inputString.match(/[^A-Za-z0-9,\. '"?\[\]/\\\-]/)) {
                        throw `The contents of the URL parameter "${urlParamName}" are malformed.`;
                    }
                }

                args.run = eval(`"use strict"; (${inputString})`);
            }

            // The run command(s) can be provided by the user as either a string or an array. For
            // our in-code convenience, let's coerce them into an array.
            args.run = [args.run].flat();

            if (args.run.some(cmd=>(typeof cmd !== "string"))) {
                throw "All run commands must be strings.";
            };

            jsdosInterface = await jsdosInstance.main(["-conf", "dosbox.conf"]);

            // Providing these shell commands via the call to jsdosInstance.main() doesn't work
            // reliably, as some commands get ignored at pseudo-random. So we'll just issue them
            // separately here. A downside is the commands don't show on the DOSBox CLI, unlike
            // when passing them via main().
            await jsdosInterface.shell(
                `mixer master ${args.dosboxMasterVolume}`,
                ...args.run,
            );

            window.document.title = (typeof args.title == "undefined")
                ? "DOSBox"
                : `${args.title} - DOSBox`;
        }
        catch (error)
        {
            throw new Error("Failed to start the DOS program: " + error);
        }
    }
    catch (error)
    {
        dosboxContainer.classList.remove("running");
        console.error("Could not run DOSBox. " + error);
        messageDisplay.textContent = error;
        messageDisplay.className = "error";
    }

    return jsdosInterface;
}

export function stop_dosbox()
{
    if (jsdosInterface &&
        (jsdosInterface.exit() === 0))
    {
        throw new Error("Failed to terminate DOSBox.")
    }

    jsdosInterface = null;

    dosboxContainer.classList.remove("running");

    return;
}

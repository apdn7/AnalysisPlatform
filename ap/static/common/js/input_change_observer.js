class InputChangeObserver {
    constructor(targetNode = document.body) {
        this.targetNode = targetNode; // Target to observe (default is entire document)
        this.observer = null; // MutationObserver instance
        this.nodeStatus = []; // Change status of all observer element in targetNode
        this.eventListeners = [];
    }

    // Initialize the observer and start detecting changes
    startObserving() {
        // Define the callback for mutation observer
        const mutationCallback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.target.dataset.observer === undefined) {
                    continue;
                }
                if (mutation.type === 'attributes') {
                    this.handleAttributeChange(mutation);
                }
                if (mutation.type === 'childList') {
                    this.handleChildListChange(mutation);
                }
            }
        };

        // Create a MutationObserver instance
        this.observer = new MutationObserver(mutationCallback);

        // Set up the observer configuration
        const config = {
            attributes: true, // Monitor attribute changes
            subtree: true, // Observe all descendants of the target node
            attributeFilter: ['value', 'checked', 'selected', 'data-mutation'], // Observe value and checked attributes
            attributeOldValue: true, // Pass old data to callback
        };

        if (this.targetNode) {
            // Attach event listeners to handle user-triggered input, select changes
            this.attachInputListeners();
            this.attachSelectListener();
            // Start observing the target node
            this.observer.observe(this.targetNode, config);
        }
    }

    // Handle changes in attributes (value, checked)
    handleAttributeChange(mutation) {
        const target = mutation.target;
        let modifyStatus = false;
        switch (target.tagName) {
            case 'SPAN':
                // if target is span, verify the innerText
                modifyStatus = target.textContent !== target.dataset.observer;
                break;
            case 'LABEL':
                // if target is label of input, verify the checked attr
                modifyStatus = target.checked !== target.oldValue;
                break;
            case 'svg':
                // svg in function table
                modifyStatus = target.dataset.mutation !== target.dataset.observer;
                break;
            case 'TBODY':
                // tbody of function cols
                modifyStatus = target.dataset.mutation !== target.dataset.observer;
                break;
            case 'SELECT':
                modifyStatus = target.value !== target.dataset.observer;
                break;
            default:
                // input
                modifyStatus = target.value !== target.dataset.observer;

                if (target.type === 'checkbox') {
                    modifyStatus = String(target.checked) !== target.dataset.observer;
                }

                if (target.type === 'radio') {
                    // update modifyStatus for other input radio when it has same input name
                    this.nodeStatus.forEach((node) => {
                        if (node.target.name === target.name && node.target !== target) {
                            node.modifyStatus = false;
                        }
                    });
                    modifyStatus = String(target.checked) !== target.dataset.observer;
                }

                break;
        }
        this.updateNodeStatus({ target, modifyStatus });
    }

    // Update node status
    updateNodeStatus(node) {
        // function white mark
        if (node.target.tagName === 'svg') {
            node.target = node.target.tagName;
        }
        const [nodeId] = this.nodeStatus.map((v, k) => (node.target === v.target ? k : null)).filter((i) => i !== null);
        if (nodeId !== undefined) {
            this.nodeStatus[nodeId] = node;
            return;
        }
        this.nodeStatus.push(node);
    }

    // Attach input listeners for real-time changes (input and change events)
    attachInputListeners(elements = null) {
        // If no specific elements are provided, target all inputs within the targetNode
        const inputs = elements || this.targetNode?.querySelectorAll('input') || [];

        inputs.forEach((input) => {
            const inputListener = (event) => {
                event.target.setAttribute('value', event.target.value);
            };

            // Attach 'input' event listener for text/number inputs
            if (input.type === 'checkbox') {
                $(input).on('change', inputListener);
            } else {
                $(input).on('input', inputListener);
            }

            // Store the listeners for potential removal later
            this.eventListeners.push({ element: input, inputListener });
        });
    }

    // Attach select listeners for changes (select and change events)
    attachSelectListener(elements = null) {
        // If no specific elements are provided, target all inputs within the targetNode
        const selects = elements || this.targetNode?.querySelectorAll('select') || [];

        selects.forEach((select) => {
            const selectListener = (event) => {
                event.target.setAttribute('value', event.target.value);
            };

            // Attach 'input' event listener for text/number inputs
            $(select).on('change', selectListener);

            // Store the listeners for potential removal later
            this.eventListeners.push({ element: select, selectListener });
        });
    }

    removeEvents() {
        this.eventListeners.forEach(({ element, inputListener, changeListener }) => {
            element.removeEventListener('input', inputListener);
            element.removeEventListener('change', changeListener);
        });

        this.eventListeners = [];
    }

    injectEvents() {
        this.removeEvents();
        this.attachInputListeners();
        this.attachSelectListener();
    }

    // Stop observing and remove all event listeners
    stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.nodeStatus = [];
            console.log('Observer stopped');
        }

        // Remove attached event listeners
        this.removeEvents();
    }
}

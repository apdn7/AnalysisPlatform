const graphNavUtil = (() => {
    // target graph html class
    // const TARGET_ELE_CLASSES = [
    //     '.active.show .js-plotly-plot',
    //     '.active.show .chart-row',
    //     '.active.show .card',
    //     '.active.show .ui-sortable-handle',
    //     '.js-plotly-plot',
    //     '.chart-row',
    //     '.card',
    //     '.ui-sortable-handle',
    // ];

    // first found class will priorty to move graph, if not found , the next one will be use
    // every screen can use their own classes list. it is useful when some page have tab
    // [.active.show card]
    // let custom_ele_classes = null;
    const TARGET_ELE_CLASSES = ['.graph-navi', '.card-body', '.card'];

    // array element is a arr , arr[0] is has class, arr[1] is has no class.
    // const EXCLUDE_ELE_CLASSES = [
    //     ['none-navi', ''],
    //     ['tab-pane', 'show'],
    // ];

    // element has at lease one will be used for move top down
    const TARGET_TOP_DOWN = 'graph-navi-top-down';

    // checker if an element in viewport
    const checkEleInView = (el) => {
        const scroll = window.scrollY || window.pageYOffset;
        const boundsTop = el.getBoundingClientRect().top + scroll;

        const viewport = {
            top: scroll,
            bottom: scroll + window.innerHeight,
        };

        const bounds = {
            top: boundsTop,
            bottom: boundsTop + el.clientHeight,
        };

        return (
            // (bounds.bottom >= viewport.top && bounds.bottom <= viewport.bottom) ||
            bounds.top <= viewport.bottom && bounds.top >= viewport.top
        );
    };

    const clearSamePosition = (eles) => {
        const unique = {};
        const retEles = [];
        eles.forEach((ele) => {
            const pos = ele.getBoundingClientRect().top;
            if (!unique[pos]) {
                unique[pos] = 1;
                retEles.push(ele);
            }
        });

        return retEles;
    };

    // const clearExclude = (eles) => {
    //     const output = [];
    //     eles.forEach((ele) => {
    //         const eleClasses = Array.from(ele.classList);
    //         let isExclude = false;
    //         for (const ex of EXCLUDE_ELE_CLASSES) {
    //             [isHas, isHasNot] = ex
    //             if (eleClasses.includes(isHas) && !eleClasses.includes(isHasNot)) {
    //                 isExclude = true;
    //                 break;
    //             }
    //         }

    //         if (isExclude === false) {
    //             output.push(ele);
    //         }
    //     });

    // return output;
    // };

    // get all graph in html page
    const getGraphs = () => {
        // let target_ele_classes = custom_ele_classes;
        // if (target_ele_classes == null) {
        //     target_ele_classes = TARGET_ELE_CLASSES
        // }

        for (const cls of TARGET_ELE_CLASSES) {
            let eles = Array.from(
                $(cls).not($('.tab-pane:not(.active.show)').find(cls)),
            );

            // eles.concat(Array.from($(document).find('*').not(tab).find(cls)));
            // eles = clearExclude(eles);
            eles = clearSamePosition(eles);
            if (eles.length > 0) {
                return eles;
            }
        }
        return [];
    };

    // get next graph to move
    const getNextGraph = (eles, step = 1, isTopDown = false) => {
        if (!eles.length) {
            return false;
        }

        let currentIdx = -1;

        for (const [idx, ele] of eles.entries()) {
            if (checkEleInView(ele)) {
                currentIdx = idx;
                break;
            }
        }

        if (currentIdx === -1) {
            if (step < 0) {
                return eles[0];
            }
            return eles[eles.length - 1];
        }

        currentIdx += step;
        if (currentIdx < 0) {
            return eles[0];
        }

        if (currentIdx >= eles.length) {
            return eles[eles.length - 1];
        }

        if (isTopDown === true) {
            let eleClasses;
            while (currentIdx >= 0 && currentIdx <= eles.length) {
                eleClasses = Array.from(eles[currentIdx].classList);
                if (eleClasses.includes(TARGET_TOP_DOWN) === true) {
                    return eles[currentIdx];
                }
                currentIdx += step;
            }

            if (step < 0) {
                return eles[0];
            }
            return eles[eles.length - 1];
        }

        return eles[currentIdx];
    };

    const getNearbyItem = (eles, step) => {
        const topPosition = $(window).scrollTop();
        if (!step) {
            // check page has no graph
            const beforeFooterItem = eles[eles.length - 2];
            const showGraphIdx = eles
                .map((ele) => $(ele).attr('class').includes(TARGET_TOP_DOWN))
                .indexOf(true, 2);
            const firstGraphIdx = showGraphIdx + 1;
            if (
                $(beforeFooterItem).attr('class').includes(TARGET_TOP_DOWN) ||
                $(eles[firstGraphIdx]).offset().top >= topPosition
            ) {
                // has no graph -> scroll to top of screen
                return eles[0];
            }
            // scroll to first of graph
            return eles[firstGraphIdx];
        }
        if (step > eles.length) {
            return eles[eles.length - 1];
        }
        // get first item which over offset from screen
        const currentItemIdx = eles
            .map((ele) => $(ele).offset().top >= topPosition)
            .indexOf(true);
        const isDownOneStep = step === 1;
        const topPositionGraphNavi = $(eles[currentItemIdx]).offset().top;
        const marginTopCurrentElem =
            parseInt($(eles[currentItemIdx]).css('margin-top').slice(0, -2)) +
            1;
        const nextIDx =
            topPositionGraphNavi > topPosition + marginTopCurrentElem &&
            isDownOneStep
                ? currentItemIdx
                : currentItemIdx + step;
        const nextItem = eles[nextIDx];
        if (!$(nextItem).is(':visible')) {
            // in case of DOM is hidden, return next DOM
            return getNearbyItem(eles, nextIDx);
        }
        return nextItem;
    };

    // scroll to element
    const moveToEle = (ele) => {
        if (ele === false) {
            return false;
        }
        $('html, body').animate(
            {
                scrollTop: $(ele).offset().top,
            },
            500,
        );

        return true;
    };

    // scroll by step
    const moveByStep = (step = 1) => {
        const eles = getGraphs();
        const ele = getNextGraph(eles, step);
        return !moveToEle(ele);
    };

    // scroll to first
    const moveFirst = () => {
        const eles = getGraphs();
        const ele = getNextGraph(eles, -1, true);
        return !moveToEle(ele);
    };

    // scroll to last
    const moveLast = () => {
        const eles = getGraphs();
        const ele = getNextGraph(eles, eles.length, true);
        return !moveToEle(ele);
    };

    // move screen by nearby position
    const move = (step = 1) => {
        const eles = getGraphs();
        const ele = getNearbyItem(eles, step);
        return !moveToEle(ele);
    };

    return {
        moveFirst,
        moveLast,
        moveByStep,
        move,
        // custom_ele_classes,
    };
})();

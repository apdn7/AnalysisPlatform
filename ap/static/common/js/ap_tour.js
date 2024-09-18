const getTourContent = () => {
    const htmlTagConst = {
        BREAK_LINE: '<br>',
        A_TAG: '<a target="_blank" href="/ap/config/filter">',
        A_END_TAG: '</a>',
        SPAN_TAG: `<span title="${$('#i18nTourStartPoint').text()}" class="shepherd-hint-text">`,
        SPAN_END_TAG: '</span>',
        FILTER_ICON:
            '<button class="btn btn-sm border-white on-demand-btn show-detail" title="グラフ描画に用いたカテゴリデータのフィルタを行います。"></button>',
    };
    const addHTMLTag = (content, htmlTag) => {
        return content.replaceAll(htmlTag, htmlTagConst[htmlTag]);
    };
    const navigate = {
        back: $('#i18nGoBack').text(),
        next: $('#i18nGoNext').text(),
        finish: $('#i18nGoFinish').text(),
    };
    // step 1
    const tourWelcome = {
        title: $('#i18nTourWelcomeTitle').text(),
        content: $('#i18nTourWelcome').text(),
        back: $('#i18nTourWelcomeQuit').text(), // quit
        next: navigate.next,
    };
    // step 2
    const tourSelectTargetVar = {
        title: $('#i18nTourSelectTargetVarTitle').text(),
        content: $('#i18nTourSelectTargetVar').text(),
        content_2: $('#i18nTourSelectTargetVarDesc').text(),
        back: navigate.back,
        next: navigate.next,
        label: $('#i18nLabelVariableDescription').text(),
        facet: $('#i18nCatExpExplain').text(),
    };
    // step 3
    const tourSelectTargetPeriod = {
        title: $('#i18nTourSelectTargetPeriodTitle').text(),
        content: $('#i18nTourSelectTargetPeriod').text(), // add desc
        back: navigate.back,
        next: navigate.next,
    };
    // step 4
    const tourSelectTargetPeriodDatePicker = {
        title: $('#i18nTourSelectTargetPeriodDatePickerTitle').text(),
        content: $('#i18nTourSelectTargetPeriodDatePicker').text(), // add desc
        back: navigate.back,
        next: $('#i18nGoNextToDataFinder').text(),
    };
    // step 5
    const tourFindData = {
        title: $('#i18nTourFindDataTitle').text(),
        content: $('#i18nTourFindData').text(), // add desc
        back: navigate.back,
        next: navigate.next,
    };
    // step 6
    const tourFindDataWithDatafinder = {
        title: $('#i18nTourFindDataWithDatafinderTitle').text(),
        content: $('#i18nTourFindDataWithDatafinder').text(), // add desc
        back: navigate.back,
        next: navigate.next,
    };
    // step 7
    const tourUseFilter = {
        title: $('#i18nTourUseFilterTitle').text(),
        content: $('#i18nTourUseFilter').text(), // add desc
        back: navigate.back,
        next: navigate.next,
    };
    // step 8
    const tourCleansing = {
        title: $('#i18nTourCleansingTitle').text(),
        content: $('#i18nTourCleansing').text(), // add desc
        back: navigate.back,
        next: navigate.next,
    };
    // step 9
    const tourShowGraph = {
        title: $('#i18nTourShowGraphTitle').text(),
        content: $('#i18nTourShowGraph').text(), // add desc
        back: navigate.back,
        next: navigate.next,
    };
    // step 10
    const tourFinish = {
        title: $('#i18nTourFinishTitle').text(),
        content: $('#i18nTourFinish').text(), // add desc
        finish: navigate.finish,
    };

    const tourCleansingContent = (cleansingContent) => {
        const exception = `<span title="${$(
            '#i18nTourCleansingExp',
        ).text()}" class="shepherd-hint-text">Exception</span> (${$(
            '#partNoDefaultName',
        ).text()}: ON)<br>`;
        const outlier = `<span title="${$(
            '#i18nTourCleansingOutl',
        ).text()}" class="shepherd-hint-text">Outlier(Trim)</span> (${$(
            '#partNoDefaultName',
        ).text()}: OFF)<br>`;
        const pulsed = `<span title="${$(
            '#i18nTourCleansingPulsed',
        ).text()}" class="shepherd-hint-text">Pulsed</span> (${$(
            '#partNoDefaultName',
        ).text()}: ON)<br>`;
        const dup = `<span title="${$(
            '#i18nTourCleansingDup',
        ).text()}" class="shepherd-hint-text">Dup</span> (${$(
            '#partNoDefaultName',
        ).text()}: ON)<br>`;
        return `${cleansingContent}${exception}${outlier}${pulsed}${dup}`;
    };

    tourSelectTargetVar.content = addHTMLTag(
        tourSelectTargetVar.content,
        'BREAK_LINE',
    );
    tourSelectTargetVar.content_2 = addHTMLTag(
        tourSelectTargetVar.content_2,
        'BREAK_LINE',
    );
    tourSelectTargetVar.content = `${tourSelectTargetVar.content}<span title="${tourSelectTargetVar.label}" 
        class="shepherd-hint-text">Label</span>, <span title="${tourSelectTargetVar.facet}" 
        class="shepherd-hint-text">Facet</span>:${tourSelectTargetVar.content_2}`;
    tourSelectTargetPeriod.content = addHTMLTag(
        tourSelectTargetPeriod.content,
        'BREAK_LINE',
    );
    tourSelectTargetPeriodDatePicker.content = addHTMLTag(
        tourSelectTargetPeriodDatePicker.content,
        'BREAK_LINE',
    );
    tourFindData.content = addHTMLTag(tourFindData.content, 'BREAK_LINE');
    tourFindDataWithDatafinder.content = addHTMLTag(
        tourFindDataWithDatafinder.content,
        'BREAK_LINE',
    );
    tourFindDataWithDatafinder.content = addHTMLTag(
        tourFindDataWithDatafinder.content,
        'SPAN_TAG',
    );
    tourFindDataWithDatafinder.content = addHTMLTag(
        tourFindDataWithDatafinder.content,
        'SPAN_END_TAG',
    );
    tourUseFilter.content = addHTMLTag(tourUseFilter.content, 'BREAK_LINE');
    tourUseFilter.content = addHTMLTag(tourUseFilter.content, 'A_TAG');
    tourUseFilter.content = addHTMLTag(tourUseFilter.content, 'A_END_TAG');
    tourUseFilter.content = addHTMLTag(tourUseFilter.content, 'FILTER_ICON');
    tourCleansing.content = addHTMLTag(tourCleansing.content, 'BREAK_LINE');
    tourCleansing.content = tourCleansingContent(tourCleansing.content);
    tourShowGraph.content = addHTMLTag(tourShowGraph.content, 'BREAK_LINE');
    tourFinish.content = addHTMLTag(tourFinish.content, 'BREAK_LINE');

    return {
        tourWelcome,
        tourSelectTargetVar,
        tourSelectTargetPeriod,
        tourSelectTargetPeriodDatePicker,
        tourFindData,
        tourFindDataWithDatafinder,
        tourUseFilter,
        tourCleansing,
        tourShowGraph,
        tourFinish,
    };
};

const tryTour = () => {
    $('body').css('overflow-x', '');
    const quitTourButton = {
        text: $('#i18nTourWelcomeQuit').text(),
        classes: 'btn btn-sm btn-secondary',
        action() {
            $('body').css('overflow-x', 'hidden');
            return this.complete();
        },
    };

    const backStepButton = {
        text: $('#i18nGoBack').text(),
        classes: 'btn btn-sm btn-secondary',
        action() {
            return this.back();
        },
    };

    const nextStepButton = {
        text: $('#i18nGoNext').text(),
        classes: 'btn btn-sm btn-primary',
        action() {
            return this.next();
        },
    };
    const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            classes: 'shadow-md bg-purple-dark',
            cancelIcon: {
                enabled: true,
            },
            buttons: [backStepButton, nextStepButton],
            scrollTo: { behavior: 'smooth', block: 'center' },
        },
    });

    const tourContent = getTourContent();
    tour.addStep({
        id: 'fpp_welcome',
        title: tourContent.tourWelcome.title,
        text: tourContent.tourWelcome.content,
        buttons: [quitTourButton, nextStepButton],
    });

    tour.addStep({
        id: 'fpp_variables',
        title: tourContent.tourSelectTargetVar.title,
        text: tourContent.tourSelectTargetVar.content,
        attachTo: {
            element: '#endPrc',
            on: 'bottom',
        },
    });

    tour.addStep({
        id: 'fpp_period',
        title: tourContent.tourSelectTargetPeriod.title,
        text: tourContent.tourSelectTargetPeriod.content,
        attachTo: {
            element: '#srtPrc',
            on: 'top',
        },
        buttons: [
            backStepButton,
            {
                text: tourContent.tourSelectTargetPeriod.next,
                classes: 'btn btn-sm btn-primary',
                action() {
                    const radioSelector = document.getElementById(
                        'radioDefaultInterval',
                    );
                    const dttmPickerSelector = document.getElementById(
                        'datetimeRangePicker',
                    );
                    radioSelector.click();
                    dttmPickerSelector.select();
                    return this.next();
                },
            },
        ],
    });

    tour.addStep({
        id: 'fpp_datetime_picker',
        title: tourContent.tourSelectTargetPeriodDatePicker.title,
        text: tourContent.tourSelectTargetPeriodDatePicker.content,
        attachTo: {
            element: '.daterangepicker',
            on: 'top',
        },
        scrollTo: false,
        buttons: [
            backStepButton,
            {
                text: tourContent.tourSelectTargetPeriodDatePicker.next,
                classes: 'btn btn-sm btn-primary',
                action() {
                    const dataFinderDOM =
                        document.getElementsByName('dataFinderBtn')[0];
                    dataFinderDOM.style.display = 'inherit';
                    return this.next();
                },
            },
        ],
        modalOverlayOpeningPadding: 50,
    });

    tour.addStep({
        id: 'fpp_datafinder1',
        // title: 'Find data with Data Finder',
        title: tourContent.tourFindData.title,
        text: tourContent.tourFindData.content,
        attachTo: {
            element: 'button[name=dataFinderBtn]',
            on: 'bottom',
        },
        scrollTo: false,
        buttons: [
            {
                text: tourContent.tourFindData.back,
                classes: 'btn btn-sm btn-secondary',
                action() {
                    closeCalenderModal();
                    const selector = document.getElementById(
                        'datetimeRangePicker',
                    );
                    selector.select();
                    return this.back();
                },
            },
            {
                text: tourContent.tourFindData.next,
                classes: 'btn btn-sm btn-primary',
                action() {
                    const selector =
                        document.getElementsByName('dataFinderBtn')[0];
                    selector.click();
                    return this.next();
                },
            },
        ],
    });

    tour.addStep({
        id: 'fpp_datafinder2',
        title: tourContent.tourFindDataWithDatafinder.title,
        text: tourContent.tourFindDataWithDatafinder.content,
        attachTo: {
            element: '#data-finder-card',
            on: 'bottom',
        },
        buttons: [
            {
                text: tourContent.tourFindDataWithDatafinder.back,
                classes: 'btn btn-sm btn-secondary',
                action() {
                    closeCalenderModal();
                    const dataFinderDOM =
                        document.getElementsByName('dataFinderBtn')[0];
                    dataFinderDOM.style.display = 'inherit';
                    const selector = document.getElementById(
                        'datetimeRangePicker',
                    );
                    selector.select();
                    return this.back();
                },
            },
            nextStepButton,
        ],
    });

    tour.addStep({
        id: 'fpp_filter',
        title: tourContent.tourUseFilter.title,
        text: tourContent.tourUseFilter.content,
        attachTo: {
            element: '#cndPrc',
            on: 'top',
        },
        buttons: [
            {
                text: tourContent.tourUseFilter.back,
                classes: 'btn btn-sm btn-secondary',
                action() {
                    const elements =
                        document.getElementById('data-finder-card');
                    const display = elements.style.display;
                    return this.back();
                },
            },
            nextStepButton,
        ],
    });

    tour.addStep({
        id: 'fpp_cleansing',
        title: tourContent.tourCleansing.title,
        text: tourContent.tourCleansing.content,
        attachTo: {
            element: '#cleansing-selection',
            on: 'top',
        },
    });

    tour.addStep({
        id: 'fpp_showgraph',
        title: tourContent.tourShowGraph.title,
        text: tourContent.tourShowGraph.content,
        advanceOn: { selector: '#showTraceDataGraph', event: 'click' },
        attachTo: {
            element: '#showTraceDataGraph',
            on: 'top',
        },
    });

    tour.addStep({
        id: 'fpp_finish',
        title: tourContent.tourFinish.title,
        text: tourContent.tourFinish.content,
        buttons: [
            backStepButton,
            {
                text: tourContent.tourFinish.finish,
                classes: 'btn btn-sm btn-primary',
                action() {
                    $('body').css('overflow-x', 'hidden');
                    return this.complete();
                },
            },
        ],
    });

    tour.start();
};

const tryTourInterface = () => {
    const keys = {
        ACCESS_COUNT: 'cumlativeAccessCount',
        TRY_TOUR: 'tryTour',
    };
    const set = (key = undefined, value = undefined) => {
        localStorage.setItem(key, value);
        return true;
    };
    const get = (key = undefined) => {
        if (key) {
            const accessCount = localStorage.getItem(key);
            return accessCount;
        }
        return 0;
    };
    const isBlink = () => {
        const accessCount = get(keys.ACCESS_COUNT);
        return accessCount < 5;
    };
    const addAccessCount = () => {
        // keys.ACCESS_COUNT
        let accessCount = get(keys.ACCESS_COUNT) || 0;
        accessCount = Number(accessCount) + 1;
        return set(keys.ACCESS_COUNT, accessCount);
    };
    const isTryTour = () => {
        const tryTour = get(keys.TRY_TOUR);
        return !!tryTour;
    };
    const reset = (key = undefined) => {
        if (key) {
            localStorage.removeItem(key);
        }
        return null;
    };
    return { keys, set, reset, isBlink, isTryTour, addAccessCount };
};

const openTour = (url = undefined, showTour = true) => {
    const goToPage = url || '/ap/fpp';
    if (showTour) {
        useTileInterface().set();
        const tour = tryTourInterface();
        tour.set(tour.keys.TRY_TOUR, true);
    }
    window.open(goToPage);
};
$(() => {
    const tour = tryTourInterface();
    const isTryTour = tour.isTryTour();
    const isBlink = tour.isBlink();
    $('#tour-btn svg').removeClass('blink_btn');
    if (isBlink) {
        $('#tour-btn svg').addClass('blink_btn');
    }
    if (isTryTour) {
        tryTour();
        tour.reset(tour.keys.TRY_TOUR);
    }
    tour.addAccessCount();
});

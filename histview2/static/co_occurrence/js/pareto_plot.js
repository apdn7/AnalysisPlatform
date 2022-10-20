const paretoPlot = (prop) => {
    const alarmNames = prop.bar.y || [];
    const totalOccurenceBar = {
        y: alarmNames.reverse(),
        x: prop.bar.x.reverse(),
        text: prop.bar.text.reverse(),
        name: prop.bar.name,
        marker: {
            color: prop.bar.marker_color.reverse(),
        },
        type: 'bar',
        orientation: prop.bar.orientation,
        hovertemplate: '%{y}:<br\>%{text}',
        textposition: 'outside',
        textfont: {
            color: '#ffffff',
        }
    };

    const lineCumRatio = {
        y: alarmNames,
        x: prop.line_cum_ratio.x.reverse(),
        name: prop.line_cum_ratio.name,
        text: prop.line_cum_ratio.text.reverse(),
        mode: 'lines+markers',
        hovertemplate: '%{y}:<br\>%{text:.2f} %',
    };

    const line80Percent = {
        y: alarmNames,
        x: prop.line_80_percent.x.reverse(),
        name: prop.line_80_percent.name,
        mode: 'lines',
        line: {
            color: prop.line_80_percent.marker_color,
        },
        hoverinfo: 'skip',
    };

    const data = [totalOccurenceBar, lineCumRatio, line80Percent];

    const layout = {
        showlegend: true,
        legend: {
            x: 0.9,
            y: 0.1,
            xanchor: 'right',
            bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: '#ffffff',
                size: 12,
            },
            autorange: 'reversed',
        },
        annotations: [],
        xaxis: {
            autorange: true,
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: 12,
            },
        },
        yaxis: {
            autorange: true,
            autotick: false,
            gridcolor: '#444444',
            tickfont: {
                color: 'rgba(255,255,255,1)',
                size: 12,
            },
        },
        plot_bgcolor: '#303030',
        paper_bgcolor: '#303030',
        margin: {
            r: 30,
            b: 20,
            t: 20,
            pad: 5,
        },
        hovermode: 'closest',
        autosize: true, // responsive histogram
    };

    Plotly.newPlot(prop.plotId, data, layout, {
        ...genPlotlyIconSettings(),
        displaylogo: false,
        responsive: true,
        useResizeHandler: true,
        style: {width: '100%', height: '100%'},
    });


}
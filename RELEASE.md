# Releases

## v4.2.0

New features and improvements

* Added "Aggregation Plot(AgP)" page.
  * This includes stacked bar charts and line charts with aggregated data.
  * For example, you can visualize stacked bar charts of production volume, number of defects along with line chart of aggregated sensor data, and explore their relationships.
  * Added sample data (/sample_data/AgP_sample_data) and a sample bookmark (10-1 AgP).
* (StP/RLP/ScP) Enabled the data finder.
* (FPP/StP/MSP) Changed the sampling logic of kernel density estimation, which is activated when the number of data points is large.
  * Changed from random sampling to equidistant sampling method to preserve minimum, maximum, and median values
* (PCA) In the T2/Q contribution plot, more character strings are displayed in the item names of the bar graphs to be displayed, and the appearance is adjusted.

Bugfixes

* Fixed a bug where an error occurred when importing data from a CSV/TSV file with no column name and the data could not be read (skipping columns with no column name)
* Fixed incorrect week number displayed in calendar picker and Data finder
* (RLP) Fixed a bug that overlapped variable names when the variable name is long.
* (SkD/PCA) Fixed a bug where the original "column name" registered in the data source was displayed instead of the "display name".

## v4.1.2

New features and improvements

* Tour: You can activate a tour to learn the basic usage of the visualization, by clicking "(?)" button on the right of the navigation bar.
* Now shows elapsed time \[sec\] of the visualization, and the timeout to abort the visualization is extended to 10 minutes.
* Improved Data Finder to let user set the datetime range from Year/Month Calender.
* Added search box on the language dropdown list.
* (FPP) You can now control the priority of the columns to sort the data points, by changing the column order on the on-demand filter window.
* (StP/RLP/ScP) Changed minimum value of "Window length" and "Interval" from 0.1 to 0.01.

Bugfixes

* Fixed a bug of duplicate serial detection, where the result change depending on whether filter/on-demand filter is used or not.
  * The Analysis Platform will extract "All", "First" (oldest datetime), or "Last" (latest datetime) record for data points with duplicate serials.
* Fixed a bug that a chattering occur when entering full width number to a halfwidth number textbox.
* (SkD) Fixed a bug that an error could occur on large number of data points (>10,000)

## v4.1.1

This version fixes an issue: the Analysis Platform checks disk usage at an unexpected frequency in a specific condition.

## v4.1.0

This version is a major update including many new functionalities and bugfixes.  
See Upgrade Manual (pdf) if you are currently using the Analysis Platform v4.0.1 or v4.0.0.

Core changes

* Now uses batch file `start_ap.bat` to start the application.
  * Improved error tracing during the activation.
  * Automatically opens web browser and generate shortcuts.
  * Now shows "Port No./Language used/Path of application folder" on the title of the console screen. (Users those activate multiple applications can now distinguish the applications by looking at the title of the console screen)
  * See Getting Started (pdf) for details.
* Default port number is changed to 7770.

New functionalities

* Data import
  * Added a function to read data which uses comma (,) as a decimal point.
  * Added a function to read data which uses commas and periods as thousands separators.
  * Added a function to read CSV/TSV file with no datetime column. Now automatically generates a dummy datetime column when it does not exist.
* Drawing Graphs
  * Functions such as on-demand filter/preprocessing/graph range adjustment/Facet division are deployed horizontally on each page.
  * Added a button to abort graph drawing.
  * Added a preprocessing function that automatically detects and removes sudden values with a large number of data in the surrounding area.
  * Added a function to save the setting information of the graph area, not only the setting area.
* DN7
  * (FPP) Added a function to display multiple switching lines at once from Label plot of Full Points Plot.
  * (MSP) Added a function to highlight in a heat map the order of correlation among the variables selected for the scatterplot matrix.
  * (StP) Added a function to stratify the character string data with a bar graph in the stratified plot.
  * (SkD) Added verification graphs of actual and predicted values, residual error plots, etc. to Sankey Diagram.

Minor changes and bugfixes
* Changed the specification to treat recurring decimals such as "3.3333" and "6.6666" as real numbers without automatically estimating them as exception values.
* A function that automatically adjusts the number of display digits for real numbers is also applied to each data point.
* Fixed a bug that caused an error when visualizing extremely small data and large data (e.g. e-10, e10)
* (MSP) Changed the logic to automatically adjust the threshold for the number of data to switch to high-speed mode in Multi Scatter Plot according to the number of selected variables
* (RLP) Fixed a bug of Facet/Div function in "Divide by category" mode of Ridge Line Plot
* (PCP) Fixed a bug where categorical data were not displayed correctly in Parallel Coordinates Plot
* (PCP) Fixed a bug that caused cast error when calculating correlation coefficients when integer items 
* (PCP) Fixed a bug that caused an error when calculating the correlation coefficient when there was an estimated value for inf/-inf in Parallel Coordinates Plot 
* (FPP) Fixed a bug where outliers disappeared when switching to full range in Full-points Plot
* \+ many other changes/bugfixes

## v4.0.1

This version fixes issues with the activation of the Analysis Platform.

* Fixed bug where Analysis Platform can not activate when changing the directory after initial activation
* Fixed bug in oss_start_app.bat where pip failed to install modules (caused when using pip 22.3)

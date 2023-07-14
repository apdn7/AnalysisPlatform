# Releases

## v4.3.1

New features and improvements

* Added `Graphical Lasso (GL)` page
  * You can visualize the partial correlation structure of the given sensor data.  
  <img src="ap/config/image/GL.png" alt="GL" width="500">
* (FPP)
  * Now, the variable with "as datetime" selected on process config page is set as a default for the index order setting
  * Removed "Order set" on Process Config page. Now all categorical variables can be set to index order setting
  * Now x-axis is set to serial series when when drawing data without date/time data (DatetimeDummy)
  * Disabled setting facet and scatter plot display at the same time
* (FPP/MSP)
  * Now adjusts the size of data points when the number of data points is less than 256
* (CHM)
  * Added an option to change the color scales
  * Changed to aggregate datetime (CT) as a real number (min/max/etc.) instead of a categorical data (counts)
  * Added `day of the week` information to hover messages
* (SkD)
  * Changed the limit of selectable target variables from 60 to 512.
  * Added a sample bookmark for binary classification.
* (PCP)
  * Now shows on-demand filters by clicking the variables
  * Changed variable order default to Correlation Coefficient|Top 8
  * Added `Move next to target variable` to the right-click context menu. This will move the selected variable to the left of the target variable
* (RLP)
  * Now the aspect ratio of the charts are adjusted when displaying on a half-screen or vertical monitor, in the same way as the FPP
* (AgP)
  * Added `Divide by term (Cyclic)`, `Divide by term (Direct)`, `Divide by data's number (Cyclic)`
  * Added options of dividing format for `Divide by calendar (Cyclic)`
* (StP)
  * Changed default setting of Y-axis to `common to all graphs` (from "graph setting value")
* (ScP)
  * Added an option to draw lines between the data points
* (Config)
  * `Auto Select` is selected by defaulted when previewing data on Process Config page
  * Now shows warning message when the file does not exist in a folder specified in CSV/TSV Import Config page
  * Now deletes `DatetimeDummy` column when other column is set to "datetime" type on Process Config page.
* Now when `Auto Update` is selected, the charts are updated without refreshing the entire page
* Removed limits on number of tabs we can open on web browser
* Added P1-P99, P5-P95, 6IQR-Major/Minor/Upper/Lower to outlier processing
* Added an option to open in a new tab to the context menu (displayed by right-clicking)
* Added a limit to the `latest` input value for the target period of each page (the upper limit of the target period is about 2 years)
* Changed the priority level of sample settings saved as default in bookmarks from 1 to 0 (Priority 0 cannot be selected in saved settings)

Bugfixes

* (FPP)
  * Fixed a bug that the result of exception value handling is different between normal mode and high speed mode
* (MSP)
  * Fixed a bug where the values of partial correlation coefficient was incorrect
* (CHM)
  * ​​​​​​​​Fixed a bug that could not display the charts when NA existed in the data
  * Fixed a bug that Y-axis variable name and Facet value were not displayed
  * Fixed the order of week numbers on X-axis and days of the week on Y-axis
  * Fixed a bug where the color bar of the output image (screenshot) had no color information
* (PCP)
  * ​​​​​​​​Fixed a bug where the DataFinder button was not displayed on the new page
  * Fixed a bug that a warning toast message appears even if no real variables were selected
  * Fixed a bug where on-demand filter in PCP showed "System" items with no value
  * Fixed a bug where variables other than the starting process in PCP were also displayed in light blue
* (SkD)
  * Fixed a bug that the binary classification is not performed when the target variable is an integer binary
* (StP/MSP)
  * Fixed a bug that the standard line does not appear
* (Config)
  * Fixed a bug that integers larger than int64 were not displayed correctly when previewing at Data Source Config page and Process Config page
  * Fixed a bug that integers with values greater than 2^53-1 were displayed with digit loss when previewing at Data Source Config page and Process Config page
  * Fixed a bug that the real number column including inf/-inf was estimated as a character string instead of a real number on Process Config page
* Fixed a bug where Data finder heatmap was not displayed for data imported from database
* Fixed a bug that the data of the column set as bit type cannot be imported in the target database for data import
* Fixed a bug that data import is not possible when column names with the same half-width and full-width names are mixed in the data source
* Fixed a bug that the density curve does not appear when IQR=0
* Fixed a bug where `Set` button did not work for data types in the search function in the target variable dropdown
* Fixed start-up problems caused by Timezone offset error that may occur when the app is first started

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

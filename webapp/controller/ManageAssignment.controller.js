sap.ui.define(
    [
        "./BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "sap/m/MessageBox", //Import MessageBox for alerts/confirmations
        "../utils/validation",
        "../model/formatter",
        'sap/ui/export/Spreadsheet',
    ],
    function(BaseController, JSONModel, MessageToast, MessageBox, utils, Formatter, Spreadsheet) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.ManageAssignment", {
                Formatter: Formatter,
                onInit: function() {
                    this.getRouter().getRoute("RouteManageAssignment").attachMatched(this._onRouteMatched, this);
                },

                _onRouteMatched: async function() {
                    var LoginFunction = await this.commonLoginFunction("ManageAssignment");
                    if (!LoginFunction) return;
                    this.getBusyDialog();
                    this._fetchCommonData("NewTask", "TaskModel", {});
                    this.MA_onSearch()
                    this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                    this.getView().getModel("LoginModel").setProperty("/HeaderName", "Create New Assignment");
                    // Check if coming back from tile page
                    if (localStorage.getItem("cameFromTilePage") === "true") {
                        this.MA_onPressClear(); // Clear filter fields
                        localStorage.removeItem("cameFromTilePage");

                        //  Delay to ensure filters are cleared before search
                        setTimeout(() => {
                            this.MA_onSearch(); // Run search with cleared filters
                        }, 0);
                    } else {
                        this.MA_onSearch(); // Normal case
                    }
                    this.initializeBirthdayCarousel();
                },

                onPressback: function() {
                    localStorage.setItem("cameFromTilePage", "true");
                    this.getRouter().navTo("RouteTilePage");
                },

                onLogout: function() {
                    this.CommonLogoutFunction();
                },
                MA_onCreateTask: function() {
                    this.manageTaskDetails(false); // false means create
                },

                MA_onEditTask: function() {
                    this.manageTaskDetails(true); // true means edit
                },

                manageTaskDetails: function(bIsEdit) {
                    const oView = this.getView();
                    const oVisibleModel = new JSONModel({
                        save: false,
                        submit: true
                    });
                    oView.setModel(oVisibleModel, "visiblePlay");

                    let oModel;

                    if (bIsEdit) {
                        oVisibleModel.setProperty("/save", true);
                        oVisibleModel.setProperty("/submit", false);

                        const oTable = this.byId("MA_id_TaskTable");
                        const oSelectedItem = oTable.getSelectedItem();

                        if (!oSelectedItem) {
                            return MessageToast.show("Please select a assignment to edit");
                        }

                        const oData = oSelectedItem.getBindingContext("TaskModel").getObject();
                        this._originalTaskData = JSON.parse(JSON.stringify(oData)); // deep copy

                        oModel = new JSONModel(this._originalTaskData); // Always use original data
                    } else {
                        this._originalTaskData = null;
                        const newTaskData = {
                            TaskName: "",
                            TaskType: "",
                            TaskTypeDescription: "",
                            StartDate: "",
                            EndDate: "",
                        };
                        oModel = new JSONModel(newTaskData);
                    }

                    oView.setModel(oModel, "EditTaskModel");

                    if (!this.oTaskDialog) {
                        sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.NewAssignment",
                            controller: this,
                        }).then(function(oDialog) {
                            this.oTaskDialog = oDialog;
                            oView.addDependent(oDialog);
                            oDialog.open();
                            this._FragmentDatePickersReadOnly(["NAF_id_StartDate", "NAF_id_EndDate"]);
                        }.bind(this));
                    } else {
                        // Reset model when reopening 
                        if (bIsEdit && this._originalTaskData) {
                            oView.getModel("EditTaskModel").setData(JSON.parse(JSON.stringify(this._originalTaskData)));
                        } else if (!bIsEdit) {
                            oView.getModel("EditTaskModel").setData({
                                TaskName: "",
                                TaskType: "",
                                TaskTypeDescription: "",
                                StartDate: "",
                                EndDate: "",
                            });
                        }
                        this.oTaskDialog.open();
                        this._FragmentDatePickersReadOnly(["NAF_id_StartDate", "NAF_id_EndDate"]);
                    }
                },

                MA_onPressClear: function() {
                    var oFilterBar = this.getView().byId("MA_id_FilterBar");
                    oFilterBar.getFilterGroupItems().forEach(function(oItem) {
                        var oControl = oItem.getControl();
                        if (oControl.setSelectedKey) {
                            oControl.setSelectedKey("");
                        } else if (oControl.setValue) {
                            oControl.setValue("");
                        }
                    });
                },

                AT_ValidateCommonFields: function(oEvent) {
                    utils._LCvalidateMandatoryField(oEvent);
                },
                AT_validateDate: function(oEvent) {
                    utils._LCvalidateDate(oEvent);
                },

                NAF_onSubmitTask: async function() {
                    const oData = this.getView().getModel("EditTaskModel").getData();
                    // Simple validation
                    if (
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("FNA_id_TaskName"), "ID") &&
                        utils._LCstrictValidationComboBox(sap.ui.getCore().byId("FNA_id_Tasktype"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("NAF_id_Description"), "ID") &&
                        utils._LCvalidateDate(sap.ui.getCore().byId("NAF_id_StartDate"), "ID") &&
                        utils._LCvalidateDate(sap.ui.getCore().byId("NAF_id_EndDate"), "ID")
                    ) {} else {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }
                    var TaskType = sap.ui.getCore().byId("FNA_id_Tasktype").getSelectedKey();
                    oData.TaskType = TaskType;
                    oData.StartDate = sap.ui.getCore().byId("NAF_id_StartDate").getValue().split("/").reverse().join('-');
                    oData.EndDate = sap.ui.getCore().byId("NAF_id_EndDate").getValue().split("/").reverse().join('-');
                    this.getBusyDialog();
                    const response = await this.ajaxCreateWithJQuery("NewTask", {
                        data: oData,
                    });
                    if (response.success === true) {
                        this.closeBusyDialog();
                        this.byId("MA_id_TaskTable").removeSelections(true)
                        MessageToast.show("Assignment created successfully!");
                        this.oTaskDialog.close();
                        this.MA_onPressClear()
                        this._fetchCommonData("NewTask", "TaskModel", {});
                        await this.CommonReadcall()
                    } else {
                        this.closeBusyDialog();
                        MessageToast.show("Failed to create assignment.");
                    }
                },

                MA_onPressSave: async function() {
                    const oSelectedItem = this.byId("MA_id_TaskTable").getSelectedItem();

                    if (!oSelectedItem) {
                        MessageToast.show("Please select a assignment to update.");
                        return;
                    }
                    if (
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("FNA_id_TaskName"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("NAF_id_Description"), "ID") &&
                        utils._LCvalidateDate(sap.ui.getCore().byId("NAF_id_StartDate"), "ID") &&
                        utils._LCvalidateDate(sap.ui.getCore().byId("NAF_id_EndDate"), "ID")
                    ) {} else {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }
                    const oData = this.getView().getModel("EditTaskModel").getData();
                    const oTaskId = oSelectedItem.getBindingContext("TaskModel").getProperty("TaskID");
                    const requestData = {
                        filters: {
                            TaskID: oTaskId
                        },
                        data: oData
                    };
                    oData.StartDate = sap.ui.getCore().byId("NAF_id_StartDate").getValue().split("/").reverse().join('-');
                    oData.EndDate = sap.ui.getCore().byId("NAF_id_EndDate").getValue().split("/").reverse().join('-');

                    this.getBusyDialog();
                    const response = await this.ajaxUpdateWithJQuery("/NewTask",
                        requestData
                    );
                    if (response.success === true) {
                        this.closeBusyDialog();
                        this.byId("MA_id_TaskTable").removeSelections(true)
                        MessageToast.show("Assignment updated successfully!");
                        this.oTaskDialog.close();
                        // this._fetchCommonData("NewTask", "TaskModel", {});
                        //this.CommonReadcall()
                        this.MA_onPressClear()
                        await this.MA_onSearch()
                    } else {
                        this.closeBusyDialog();
                        MessageToast.show("Failed to update assignment.");
                    }
                },

                NAF_onTaskClose: function() {
                    // var oModel = this.getView().getModel("EditTaskModel");
                    this.byId("MA_id_TaskTable").removeSelections(true);
                    // Reset value states
                    sap.ui.getCore().byId("FNA_id_TaskName").setValueState("None");
                    sap.ui.getCore().byId("NAF_id_Description").setValueState("None");
                    sap.ui.getCore().byId("NAF_id_StartDate").setValueState("None");
                    sap.ui.getCore().byId("NAF_id_EndDate").setValueState("None");
                    // Refresh the model

                    // Close the dialog if it exists
                    if (this.oTaskDialog) {
                        // Reset form binding 
                        this.oTaskDialog.close();
                    }
                },

                MA_onSearch: async function() {
                    var aFilterItems = this.byId("MA_id_FilterBar").getFilterGroupItems();
                    var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "yyyy-MM-dd"
                    })
                    var params = {};
                    aFilterItems.forEach(function(oItem) {
                        var oControl = oItem.getControl();
                        var sValue = oItem.getName();
                        if (oControl && oControl.getValue()) {
                            if (sValue === "StartDate") {
                                params["startDate"] = oDateFormat.format(new Date(oControl.getValue().split(' - ')[0]));
                                params["endDate"] = oDateFormat.format(new Date(oControl.getValue().split(' - ')[1]));
                            } else {
                                params[sValue] = oControl.getValue();
                            }
                        }
                    });
                    await this.CommonReadcall(params); // read call for trainee after filter
                },

                CommonReadcall: async function(params) {
                    try {
                        this.getBusyDialog();
                        const response = await this.ajaxReadWithJQuery("NewTask", params);
                        if (response.success === true) {
                            this.closeBusyDialog();
                            const taskData = Array.isArray(response.data) ? response.data : [response.data];

                            // Filtered result for table 
                            const oTableModel = new JSONModel(taskData);
                            this.getView().setModel(oTableModel, "TaskModel");

                            // Only update TaskListModel if we're doing a full refresh (no params)
                            if (!params || Object.keys(params).length === 0) {
                                const oFullListModel = new JSONModel(taskData);
                                this.getView().setModel(oFullListModel, "TaskListModel");
                            }
                        }
                    } catch (error) {
                        this.closeBusyDialog();
                        MessageToast.show("Request failed");
                    }
                },

                MA_onItemPress: function(oEvent) {
                    const oSelectedItem = oEvent.getSource().getBindingContext("TaskModel").getObject();
                    this.getRouter().navTo("RouteAssignTask", {
                        taskID: oSelectedItem.TaskID, // Pass actual TaskID
                    });
                },

                MA_onstartDatevalidateDate: function(oEvent) {
                    const oStartDatePicker = oEvent.getSource();
                    const oStartDate = oStartDatePicker.getDateValue();

                    if (!oStartDate) {
                        oStartDatePicker.setValueState("Error");
                        oStartDatePicker.setValueStateText("Invalid start date");
                        return;
                    } else {
                        oStartDatePicker.setValueState("None"); //  Reset if valid
                    }

                    const oEndDatePicker = sap.ui.getCore().byId("NAF_id_EndDate");

                    if (oEndDatePicker) {
                        let oEndDate = oEndDatePicker.getDateValue();
                        oEndDatePicker.setMinDate(oStartDate);
                        if (oEndDate && oEndDate < oStartDate) {
                            oEndDatePicker.setDateValue(null);
                            oEndDatePicker.setValueState("Error");
                            oEndDatePicker.setValueStateText("End date must be after start date.");
                        } else if (oEndDate) {
                            oEndDatePicker.setValueState("None"); //  Reset EndDate state if valid
                        }
                    }
                },

                MA_DownloadTableData: function() {
                    var table = this.byId("MA_id_TaskTable");
                    const oModelData = table.getModel("TaskModel").getData();
                    const aFormattedData = oModelData.map(item => {
                        return {
                            ...item,
                            StartDate: Formatter.formatDate(item.StartDate),
                            EndDate: Formatter.formatDate(item.EndDate),
                            TotalAmountCurrency: item.TotalAmount + " " + item.Currency

                        };
                    });
                    const aCols = [{
                            label: this.i18nModel.getText("assignmentName"),
                            property: "TaskName",
                            type: "string"
                        },
                        {
                            label: this.i18nModel.getText("assignmentType"),
                            property: "TaskType",
                            type: "string"
                        },
                        {
                            label: this.i18nModel.getText("assignmentDes"),
                            property: "TaskTypeDescription",
                            type: "string"
                        },
                        {
                            label: this.i18nModel.getText("startDate"),
                            property: "StartDate",
                            type: "string"
                        },
                        {
                            label: this.i18nModel.getText("endDate"),
                            property: "EndDate",
                            type: "string"
                        }
                    ];
                    const oSettings = {
                        workbook: {
                            columns: aCols,
                            context: {
                                sheetName: this.i18nModel.getText("invoiceapp")
                            }
                        },
                        dataSource: aFormattedData,
                        fileName: "ManageAssignmentDetails.xlsx"
                    };
                    const oSheet = new Spreadsheet(oSettings);
                    oSheet.build().then(function() {
                            MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                        }.bind(this))
                        .finally(function() {
                            oSheet.destroy();
                        });
                },

                AT_onChangeTaskType: function(oEvent) {
                    utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
                },

                MA_onDeleteTask: function() {
                    const oSelectedItem = this.byId("MA_id_TaskTable").getSelectedItem();

                    if (!oSelectedItem) {
                        MessageToast.show(this.i18nModel.getText("smgforedeletetask"));
                        return;
                    }

                    const oData = oSelectedItem.getBindingContext("TaskModel").getObject();
                    const oTaskId = oData.TaskID;
                    this.showConfirmationDialog(this.i18nModel.getText("confirmTitle"), this.i18nModel.getText("smgconfirmdeletetask"), async () => {
                        this.getBusyDialog();
                        try {
                            await this.ajaxDeleteWithJQuery("NewTask", {
                                filters: {
                                    TaskID: oTaskId,
                                },
                            });
                            MessageToast.show(this.i18nModel.getText("smgtaskdeleted"));
                            this.MA_onPressClear();
                            await this.MA_onSearch();
                        } catch (error) {
                             return MessageBox.error(error.message || this.i18nModel.getText("smgtaskerrorMessage"));
                        } finally {
                            this.closeBusyDialog();
                        }
                    });
                },
                MA_onEmpTask:function(){
                    this.getRouter().navTo("RouteEmployeeAssignment");
                }
            },
        );
    }
);
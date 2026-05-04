sap.ui.define(
    [
        "./BaseController",
        "../utils/validation",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "sap/m/MessageBox"
    ],
    function (BaseController, utils, JSONModel, MessageToast, MessageBox) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.AssignTask", {
            onInit: function () {
                this.getRouter().getRoute("RouteAssignTask").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: async function (oEvent) {
                var LoginFunction = await this.commonLoginFunction("ManageAssignment");
                if (!LoginFunction) return;
                this.getBusyDialog();
                const sTaskID = oEvent.getParameter("arguments").taskID;
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                // Save the taskID to the controller

                this._currentTaskID = sTaskID;
                this._fetchTaskDetails(sTaskID);
                this.readCallForAllLoginDetails();
                this.CommonReadcall({
                    TaskID: sTaskID
                });
                this.FAT_onSearch()
                this.initializeBirthdayCarousel();
            },

            onLogout: function () {
                this.CommonLogoutFunction();
            },

            _fetchTaskDetails: async function (sTaskID) {
                try {
                    const response = await this.ajaxReadWithJQuery("NewTask", {
                        TaskID: sTaskID,
                    });

                    if (response.success) {
                        this.closeBusyDialog();
                        const oTaskDetails = Array.isArray(response.data) ?
                            response.data[0] :
                            response.data;

                        // Set view-level model for ObjectHeader
                        this.getView().setModel(new JSONModel(oTaskDetails), "TaskDetailsModel");

                        // Set this as the current task ID for reuse
                        this._currentTaskID = oTaskDetails.TaskID;
                        // Set task details model
                        this.getView().setModel(new JSONModel(oTaskDetails), "TaskDetailsModel");
                        this._currentTaskID = oTaskDetails.TaskID;

                        // Prepare newTaskModel with minDate and maxDate
                        const oNewTaskModel = new JSONModel({
                            minDate: new Date(oTaskDetails.StartDate),
                            maxDate: new Date(oTaskDetails.EndDate)
                        });

                        // Set this model at view level so fragment can access it
                        this.getView().setModel(oNewTaskModel, "newTaskModel");
                    }
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("smgerrorloading"));
                }
            },

            readCallForAllLoginDetails: async function (filter) {
                // Fetch all login details
                await this.ajaxReadWithJQuery("AllLoginDetails", filter)
                    .then((oData) => {
                        let loginData = Array.isArray(oData.data) ? oData.data : [oData.data];

                        // Set full data model
                        this.getView().setModel(
                            new JSONModel(loginData), "LoginDetailsModel"
                        );

                        // If "Initial", filter unique entries by LoginID or another field
                        if (filter === "Initial") {
                            const uniqueLoginData = [...new Map(loginData.filter((item) => item.LoginID && item.LoginID.trim() !== "").map((item) => [item.LoginID.trim(), item])).values(),];

                            this.getView().setModel(
                                new JSONModel(uniqueLoginData), "AllLoginDetailsModelInitial"
                            );
                        }
                        this.closeBusyDialog();
                    })
                    .catch((oError) => {
                        this.closeBusyDialog();
                        MessageToast.show(this.i18nModel.getText("smgerrorlogindetails"));
                    });
            },

            AT_validateDate: function (oEvent) {
                utils._LCvalidateDate(oEvent);
            },

            AT_ValidateCommonFields: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent);
            },

            FAT_onchangeEmpId: function (oEvent) {
                utils._LCvalidationComboBox(oEvent);
            },

            AT_ValidateHournFields: function (oEvent) {
                utils._LCvalidateTimeLimit(oEvent);
            },

            AT_onPressback: function () {
                this.getRouter().navTo("RouteManageAssignment");
            },

            //open task fragment
            AT_onAssignEmpTask: function () {
                this.manageTaskDetails(false); // false means create
            },

            AT_onEditTask: function () {
                this.manageTaskDetails(true); // true means edit
            },

            manageTaskDetails: function (bIsEdit) {
                const oView = this.getView();
                // Add 'isEditMode' to track edit state (true = edit mode, false = create mode)
                const oVisibleModel = new JSONModel({
                    save: false,
                    submit: true,
                    isEditMode: bIsEdit, // New property to control field editability
                });
                oView.setModel(oVisibleModel, "visiblePlay");

                let oModel;

                if (bIsEdit) {
                    oVisibleModel.setProperty("/save", true);
                    oVisibleModel.setProperty("/submit", false);

                    const oTable = this.byId("AT_id_TaskTable");
                    const aSelectedItems = oTable.getSelectedItems(); //  multi-select

                    if (!aSelectedItems.length) {
                        return MessageToast.show(this.i18nModel.getText("smgforedittask"));
                    }

                    // Get all selected row data
                    const aSelectedData = aSelectedItems.map(item =>
                        item.getBindingContext("AssignModel").getObject()
                    );

                    // Extract Employee IDs → IMPORTANT for MultiComboBox
                    const aEmployeeIDs = aSelectedData.map(obj => obj.EmployeeID);

                    // (Optional but recommended) Validate same task
                    const isSameTask = aSelectedData.every(
                        item => item.TaskID === aSelectedData[0].TaskID
                    );

                    if (!isSameTask) {
                        return MessageToast.show("Please select records with same Task");
                    }

                    // Take common values from first record
                    const oFirst = aSelectedData[0];

                    // Prepare model for fragment
                    const oEditData = {
                        EmployeeID: aEmployeeIDs,   // ✅ ARRAY → this fixes your issue
                        EmployeeName: "",
                        HoursWorked: oFirst.HoursWorked,
                        TaskName: oFirst.TaskName,
                        TaskID: oFirst.TaskID,
                        StartDate: oFirst.StartDate,
                        EndDate: oFirst.EndDate
                    };

                    // Store original full data (for save/update logic)
                    this._originalTaskData = JSON.parse(JSON.stringify(aSelectedData));

                    oModel = new JSONModel(oEditData);
                } else {
                    this._originalTaskData = null;

                    //  Get StartDate from the view model
                    const oTaskDetails = this.getView().getModel("TaskDetailsModel")?.getData();
                    const sStartDateFromView = new Date().toISOString().split("T")[0];
                    const sEndDateFromView = oTaskDetails?.EndDate || "";

                    const newTaskData = {
                        EmployeeID: "",
                        EmployeeName: "",
                        HoursWorked: "",
                        TaskName: "",
                        TaskID: "",
                        StartDate: sStartDateFromView, // Set from view
                        EndDate: sEndDateFromView,
                    };

                    oModel = new JSONModel(newTaskData);
                }

                oView.setModel(oModel, "EditTaskModel");

                if (!this.oTaskDialog) {
                    sap.ui.core.Fragment.load({
                        name: "sap.kt.com.minihrsolution.fragment.AssignTask",
                        controller: this,
                    }).then(
                        function (oDialog) {
                            this.oTaskDialog = oDialog;
                            oView.addDependent(oDialog);
                            oDialog.open();
                            this._FragmentDatePickersReadOnly(["FAT_id_StartDate", "FAT_id_EndDate"]);
                        }.bind(this)
                    );
                } else {
                    this.oTaskDialog.open();
                    this._FragmentDatePickersReadOnly(["FAT_id_StartDate", "FAT_id_EndDate"]);
                }
            },

            FAT_onTaskClose: function () {
                if (this.oTaskDialog) {
                    this.byId("AT_id_TaskTable").removeSelections(true);

                    sap.ui.getCore().byId("FAT_id_EmployeeID").setValueState(sap.ui.core.ValueState.None);
                    sap.ui.getCore().byId("FAT_id_StartDate").setValueState(sap.ui.core.ValueState.None);
                    sap.ui.getCore().byId("FAT_id_EndDate").setValueState(sap.ui.core.ValueState.None);
                    sap.ui.getCore().byId("FAT_id_HoursWorked").setValueState(sap.ui.core.ValueState.None);

                    this.oTaskDialog.close();
                }
            },
            FAT_onSearch: function () {
                const params = {
                    // Always include the current task ID
                    TaskID: this._currentTaskID
                };
                this._fetchCommonData("AssignedTask", "AssignModel", params);
                this.CommonReadcall(params);
            },



            CommonReadcall: async function (params) {
                try {
                    this.getBusyDialog();
                    const response = await this.ajaxReadWithJQuery(
                        "AssignedTask",
                        params
                    );
                    if (response.success) {
                        this.closeBusyDialog();
                        let taskData = Array.isArray(response.data) ? response.data : [response.data];

                        const aEmployees =
                            this.getView().getModel("LoginDetailsModel")?.getData() || [];

                        // Enrich data with EmployeeName
                        taskData = taskData.map((task) => {
                            if (task.EmployeeID) {
                                const empIDs = task.EmployeeID.split(",");
                                const names = empIDs.map((id) => {
                                    const emp = aEmployees.find((e) => e.EmployeeID === id);
                                    return emp ? emp.EmployeeName : "";
                                }).filter((name) => name !== "").join(", ");
                                task.EmployeeName = names;
                            }
                            return task;
                        });

                        this.getView().setModel(new JSONModel(taskData), "AssignModel");
                    }
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("smgerrorassigntask"));
                }
            },

            //Submit the task details
            FAT_onSubmitTask: async function () {
                const oView = this.getView();
                const aEmployees = oView.getModel("LoginDetailsModel").getData();

                // Validate all fields
                if (
                    !utils._LCvalidationComboBox(sap.ui.getCore().byId("FAT_id_EmployeeID"), "ID") ||
                    !utils._LCvalidateDate(sap.ui.getCore().byId("FAT_id_EndDate"), "ID") ||
                    !utils._LCvalidateTimeLimit(sap.ui.getCore().byId("FAT_id_HoursWorked"), "ID")
                ) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }

                const aSelectedIDs = sap.ui.getCore().byId("FAT_id_EmployeeID").getSelectedKeys().filter(key => key.trim() !== "");
                const sTaskID = sap.ui.getCore().byId("FAT_id_TaskID").getValue();

                // Fetch existing assignments for current TaskID
                const aAssignedTasks = oView.getModel("AssignModel").getData() || [];

                // Extract already assigned EmployeeIDs
                const existingEmployeeIDs = aAssignedTasks.map(task => task.EmployeeID.trim());
                const aFilteredIDs = aSelectedIDs.filter(id => !existingEmployeeIDs.includes(id.trim()));

                if (aFilteredIDs.length === 0) {
                    MessageBox.error(this.i18nModel.getText("smgEmptask"));
                    this.oTaskDialog.close();
                    return;
                }

                const sTaskName = sap.ui.getCore().byId("FAT_id_TaskName").getValue();
                const sHoursWorked = sap.ui.getCore().byId("FAT_id_HoursWorked").getValue();
                const sStartDate = sap.ui.getCore().byId("FAT_id_StartDate").getValue();
                const sEndDate = sap.ui.getCore().byId("FAT_id_EndDate").getValue();

                // Construct full payload array
                const aPayloadData = aFilteredIDs.map(empID => {
                    const oEmployee = aEmployees.find(emp => emp.EmployeeID === empID);
                    return {
                        TaskID: sTaskID,
                        TaskName: sTaskName,
                        EmployeeID: empID,
                        EmployeeName: oEmployee ? oEmployee.EmployeeName : "",
                        HoursWorked: sHoursWorked,
                        StartDate: sStartDate.split("/").reverse().join('-'),
                        EndDate: sEndDate.split("/").reverse().join('-')

                    };
                });

                this.getBusyDialog();
                const response = await this.ajaxCreateWithJQuery("AssignedTask", {
                    data: aPayloadData
                });
                if (response.success) {
                 
                    await this._fetchCommonData("AssignedTask", "AssignModel", {
                        TaskID: sTaskID
                    });
                    await this.CommonReadcall({
                        TaskID: sTaskID
                    });
                    
                    //  Reset EditTaskModel to clear previous values
                    MessageToast.show("Employee assigned successfully");
                    this.oTaskDialog.close();
                    this.getView().setModel(null, "EditTaskModel");
                    sap.ui.getCore().byId("FAT_id_EmployeeID").setSelectedKeys([]);
                    sap.ui.getCore().byId("FAT_id_StartDate").setDateValue(null)
                    
                } else {
                    MessageToast.show(this.i18nModel.getText("smgFailtoassign"));
                }
            },

            //Update the task details
            MA_onPressSave: async function () {
                const oTable = this.byId("AT_id_TaskTable");
                const aSelectedItems = oTable.getSelectedItems(); // ✅ multi-select

                if (!aSelectedItems.length) {
                    MessageToast.show(this.i18nModel.getText("smgSelecttask"));
                    return;
                }

                //  Extract selected data
                const aSelectedData = aSelectedItems.map(item =>
                    item.getBindingContext("AssignModel").getObject()
                );

                //  Extract Employee IDs
                const aEmployeeIDs = aSelectedData.map(obj => obj.EmployeeID);

                //  Convert based on count
                const vEmployeeID = aEmployeeIDs.length === 1
                    ? aEmployeeIDs[0]        // string
                    : aEmployeeIDs;          // array

                //  Validation
                if (
                    !utils._LCvalidationComboBox(sap.ui.getCore().byId("FAT_id_EmployeeID"), "ID") ||
                    !utils._LCvalidateDate(sap.ui.getCore().byId("FAT_id_EndDate"), "ID")

                ) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }

                //  Date formatting
                const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd"
                });

                const sStartDate = oDateFormat.format(
                    sap.ui.getCore().byId("FAT_id_StartDate").getDateValue()
                );

                const sEndDate = oDateFormat.format(
                    sap.ui.getCore().byId("FAT_id_EndDate").getDateValue()
                );

                //  TaskID (same for all selected rows)
                const sTaskID = aSelectedData[0].TaskID;

                //  Payload
                const oData = {
                    EmployeeID: vEmployeeID,
                    TaskID: sTaskID,
                    StartDate: sStartDate,
                    EndDate: sEndDate
                };

                try {
                    this.getBusyDialog();

                    const response = await this.ajaxUpdateWithJQuery("/AssignedTask", {
                        data: oData
                    });

                    if (response.success) {
                        this._fetchCommonData("AssignedTask", "AssignModel");
                        this.FAT_onSearch();
                        this.oTaskDialog.close();
                        oTable.removeSelections();

                        MessageToast.show(this.i18nModel.getText("smgUpdatetask"));
                    } else {
                        this.closeBusyDialog();
                        MessageToast.show("Update failed: " + (response.message || ""));
                    }
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show("Error updating task: " + error.message);
                }
            },

            AT_onstartDatevalidateDate: function (oEvent) {
                const oStartDatePicker = oEvent.getSource();
                const oStartDate = oStartDatePicker.getDateValue();

                if (!oStartDate) {
                    oStartDatePicker.setValueState("Error");
                    oStartDatePicker.setValueStateText("Invalid start date");
                    return;
                } else {
                    oStartDatePicker.setValueState("None"); //  Reset if valid
                }
                const oEndDatePicker = sap.ui.getCore().byId("FAT_id_EndDate");

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

            // Unassign Employee from Task
            AT_onDeleteTask: function () {
                const oTable = this.byId("AT_id_TaskTable");
                const aSelectedItems = oTable.getSelectedItems();

                //  No selection
                if (!aSelectedItems.length) {
                    MessageToast.show(this.i18nModel.getText("smgSelecttaskdelete"));
                    return;
                }

                //  Extract selected data
                const aSelectedData = aSelectedItems.map(item =>
                    item.getBindingContext("AssignModel").getObject()
                );

                //  Extract Employee IDs
                const aEmployeeIDs = aSelectedData.map(obj => obj.EmployeeID);

                //  TaskID (assume same for all)
                const sTaskID = aSelectedData[0].TaskID;

                //  Validate same TaskID
                const isSameTask = aSelectedData.every(item => item.TaskID === sTaskID);

                if (!isSameTask) {
                    MessageToast.show("Please select records with same Task");
                    return;
                }

                const that = this;

                this.showConfirmationDialog(
                    this.i18nModel.getText("msgBoxConfirm"),
                    this.i18nModel.getText("smgconfirmdeleteassignedemployee"),

                    //  onConfirm
                    function () {
                        that.getBusyDialog();

                        //  Loop delete (backend-safe)
                        const aPromises = aEmployeeIDs.map(empId => {
                            return that.ajaxDeleteWithJQuery("/AssignedTask", {
                                filters: {
                                    EmployeeID: empId,
                                    TaskID: sTaskID
                                }
                            });
                        });

                        Promise.all(aPromises)
                            .then((responses) => {

                                //  Check all success
                                const allSuccess = responses.every(res => res.success);

                                if (allSuccess) {
                                    that._fetchCommonData("AssignedTask", "AssignModel");
                                    that.FAT_onSearch();

                                    MessageToast.show(
                                        that.i18nModel.getText("smgassignedemployeedeleted")
                                    );
                                } else {
                                    MessageToast.show("Some records failed to delete");
                                }

                                //  Cleanup
                                oTable.removeSelections(true);
                                that.closeBusyDialog();
                            })
                            .catch((error) => {
                                that.closeBusyDialog();

                                MessageToast.show(
                                    that.i18nModel.getText("smgerrorassigntask")
                                );

                                oTable.removeSelections(true);
                            });
                    },

                    //  onCancel
                    function () {
                        oTable.removeSelections(true);
                    }
                );
            }
        }
        );
    }
);
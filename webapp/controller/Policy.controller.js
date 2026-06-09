sap.ui.define(
    ["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/core/Fragment", "sap/m/MessageBox", "sap/m/MessageToast", "../utils/validation", "../model/formatter",],
    function (BaseController, JSONModel, Fragment, MessageBox, MessageToast, Validation, formatter,) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.Policy", {
            Formatter: formatter,
            onInit: function () {
                this.getRouter().getRoute("RoutePolicy").attachMatched(this.PL_onRouteMatched, this);
                this._employeeCache = null;
                this._employeePromise = null;
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
                // TODAY MODEL FOR DATE PICKER MIN DATE
                this.getView().setModel(new JSONModel({
                    today: new Date()
                }), "todayModel");
                // SAFE LOGIN MODEL CHECK
                var oLoginModel = this.getView().getModel("LoginModel");
                var sRole = "";
                if (oLoginModel) {
                    sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase();
                }
                var bShowAdminControls = sRole === "admin" || sRole === "hr manager";
                this.getView().setModel(new JSONModel({
                    showAdminControls: bShowAdminControls
                }), "visibilityModel");
            },
            _applyStartDateStyle: function () {
                const oView = this.getView();
                if (!oView) return;
                const oModel = oView.getModel("VisibleModel");
                if (!oModel) return; // 🔴 IMPORTANT FIX
                const bEdit = oModel.getProperty("/EditBtn");
                const oLabel = this.byId("PL_id_StartDateLabel");
                const oText = this.byId("PL_id_StartDateText");
                if (!oLabel || !oText) return;
                if (bEdit) {
                    oLabel.removeStyleClass("sapUiTinyMarginTop");
                    oText.removeStyleClass("sapUiTinyMarginTop");
                } else {
                    oLabel.addStyleClass("sapUiTinyMarginTop");
                    oText.addStyleClass("sapUiTinyMarginTop");
                }
            },
            _getEmployeeDetails: async function () {
                if (this._employeeCache) {
                    return this._employeeCache;
                }
                if (this._employeePromise) {
                    return this._employeePromise;
                }
                const oLoginModel = this.getView().getModel("LoginModel");
                const sEmployeeID = oLoginModel.getProperty("/EmployeeID");
                this._employeePromise = this.ajaxReadWithJQuery("EmployeeDetails", {
                    EmployeeID: sEmployeeID
                }).then((oResponse) => {
                    let sDepartment = "";
                    let sRole = "";
                    if (oResponse && oResponse.success && oResponse.data && oResponse.data.length > 0) {
                        const oEmployee = oResponse.data[0];
                        sDepartment = (oEmployee.Department || "").toLowerCase().trim();
                        sRole = (oEmployee.Role || "").toLowerCase().trim();
                    }
                    this._employeeCache = {
                        department: sDepartment,
                        role: sRole
                    };
                    oLoginModel.setProperty("/Department", sDepartment);
                    oLoginModel.setProperty("/Role", sRole);
                    return this._employeeCache;
                }).catch((oError) => {
                    this._employeeCache = {
                        department: "",
                        role: ""
                    };
                    return this._employeeCache;
                }).finally(() => {
                    this._employeePromise = null;
                });
                return this._employeePromise;
            },
            PL_loadRoleDepartment: async function () {
                const oView = this.getView();
                const oLoginModel = oView.getModel("LoginModel");
                const sEmpId = oLoginModel.getProperty("/EmployeeID");
                const oResponse = await this.ajaxReadWithJQuery("Role_Department", {
                    EmpID: sEmpId
                });
                let aData = [];
                if (oResponse && oResponse.success) {
                    aData = oResponse.data.map(function (item) {
                        return {
                            department: item.Department || "",
                            // NEW FIELD
                            role: item.Role || "",
                            // KEEP OLD FIELD FOR EXISTING CODE
                            designationName: item.Role || ""
                        };
                    });
                }
                this.getView().setModel(new JSONModel(aData), "DesignationModel");
                const oDepartmentMap = {};
                const aDepartments = [];
                aData.forEach(function (oItem) {
                    const sDepartment = (oItem.department || "").trim();
                    if (sDepartment && !oDepartmentMap[sDepartment.toLowerCase()]) {
                        oDepartmentMap[sDepartment.toLowerCase()] = true;
                        aDepartments.push({
                            department: sDepartment
                        });
                    }
                });
                this.getView().setModel(new JSONModel(aDepartments), "DepartmentModel");
                const oRoleMap = {};
                const aRoles = [];
                aData.forEach(function (oItem) {
                    const sRole = (oItem.role || "").trim();
                    const sDepartment = (oItem.department || "").trim();
                    const sKey = sDepartment.toLowerCase() + "_" + sRole.toLowerCase();
                    if (sRole && !oRoleMap[sKey]) {
                        oRoleMap[sKey] = true;
                        aRoles.push({
                            department: sDepartment,
                            // NEW
                            role: sRole,
                            // KEEP OLD
                            designationName: sRole
                        });
                    }
                });
                this.getView().setModel(new JSONModel(aRoles), "RoleModel");
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
            },
            // POLICY VISIBILITY FILTER
            PL_filterPoliciesByAccess: async function (aPolicies) {
                const oEmp = await this._getEmployeeDetails();
                const sEmployeeDepartment = (oEmp.department || "").toLowerCase().trim();
                const sEmployeeRole = (oEmp.role || "").toLowerCase().trim();
                const aFilteredPolicies = aPolicies.filter(function (oPolicy, iIndex) {
                    const sPolicyDepartment = (oPolicy.Department || oPolicy.department || "").toLowerCase().trim();
                    const sPolicyRole = (oPolicy.Role || oPolicy.role || "").toLowerCase().trim();
                    // ADMIN / HR MANAGER
                    if (sEmployeeRole === "admin" || sEmployeeRole === "hr manager") {
                        return true;
                    }
                    // ALL / ALL
                    if (sPolicyDepartment === "all" && sPolicyRole === "all") {
                        return true;
                    }
                    // ALL DEPARTMENT + ROLE MATCH
                    if (sPolicyDepartment === "all" && sPolicyRole === sEmployeeRole) {
                        return true;
                    }
                    // DEPARTMENT MATCH + ALL ROLE
                    if (sPolicyDepartment === sEmployeeDepartment && sPolicyRole === "all") {
                        return true;
                    }
                    // EXACT MATCH
                    if (sPolicyDepartment === sEmployeeDepartment && sPolicyRole === sEmployeeRole) {
                        return true;
                    }
                    return false;
                });
                return aFilteredPolicies;
            },
            // ROUTE MATCHED
            PL_onRouteMatched: async function () {
                try {
                    this._employeeCache = null;
                    this._employeePromise = null;
                    var LoginFunction = await this.commonLoginFunction("Policy");
                    if (!LoginFunction) {
                        return;
                    }
                    this.getBusyDialog();
                    const oView = this.getView();
                    const oLoginModel = oView.getModel("LoginModel");
                    this.i18nModel = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                    oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("policyTitle"));
                    // Load Employee Details First
                    await this._getEmployeeDetails();
                    // Load Role Department
                    await this.PL_loadRoleDepartment();
                    this.byId("PL_id_SearchPolicy").setValue("");
                    this.byId("PL_id_DepartmentFilter").setValue("");
                    this.byId("PL_id_RoleFilter").setValue("");
                    // Load Policies After Employee Details
                    await this.PL_loadPolicies();
                    this.getView().setModel(new JSONModel({
                        EditBtn: true
                    }), "VisibleModel");
                    const sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase().trim();
                    const bShowAdminControls = sRole === "admin" || sRole === "hr manager";
                    this.getView().setModel(new JSONModel({
                        showAdminControls: bShowAdminControls
                    }), "visibilityModel");
                    sap.ui.getCore().applyChanges();
                    this.closeBusyDialog();
                } catch (oError) {
                    this.closeBusyDialog();
                    MessageBox.error(oError.message || "Failed to load policies");
                }
            },
            PL_applyFilter: function (sDepartment, sRole) {
                const oTable = this.byId("PL_id_PolicyTable");
                const oBinding = oTable.getBinding("items");
                let aFilters = [];
                if (sDepartment) {
                    aFilters.push(new sap.ui.model.Filter("department", sap.ui.model.FilterOperator.EQ, sDepartment));
                }
                if (sRole) {
                    aFilters.push(new sap.ui.model.Filter("role", sap.ui.model.FilterOperator.EQ, sRole));
                }
                oBinding.filter(aFilters);
            },
            // LOAD POLICIES
            PL_loadPolicies: async function (aFilters = []) {
                try {
                    const oResponse = await this.ajaxReadWithJQuery("Policy", aFilters && aFilters.length ? aFilters[0] : {});
                    let aPolicies = [];
                    if (oResponse && oResponse.success && oResponse.data) {
                        aPolicies = oResponse.data.map(function (oItem, index) {
                            // IMAGE 
                            let sImageUrl = "sap-icon://person-placeholder";
                            if (oItem.Logo) {
                                if (typeof oItem.Logo === "string") {
                                    sImageUrl = "data:image/png;base64," + oItem.Logo;
                                } else if (oItem.Logo.data) {
                                    const sBase64 = new TextDecoder().decode(new Uint8Array(oItem.Logo.data));
                                    sImageUrl = "data:image/png;base64," + sBase64;
                                }
                            }
                            //  ITEMS 
                            const aItems = Array.isArray(oItem.Items) ? oItem.Items : [];
                            const today = new Date();
                            // Remove time part
                            today.setHours(0, 0, 0, 0);
                            // ACTIVE VERSION 
                            let aActiveVersions = aItems.filter(function (v) {
                                if (!v.Start_Date) {
                                    return false;
                                }
                                const dStart = new Date(v.Start_Date);
                                dStart.setHours(0, 0, 0, 0);
                                let dEnd = null;
                                if (v.End_Date && !String(v.End_Date).includes("1899-11-30")) {
                                    dEnd = new Date(v.End_Date);
                                    dEnd.setHours(0, 0, 0, 0);
                                }
                                // Open-ended version
                                if (!dEnd) {
                                    return dStart <= today;
                                }
                                return (dStart <= today && today <= dEnd);
                            });
                            let oLatest = null;
                            // Active version exists
                            if (aActiveVersions.length > 0) {
                                oLatest = aActiveVersions.reduce(function (max, item) {
                                    return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
                                });
                            }
                            // No active version -> latest version
                            // No active version
                            else if (aItems.length > 0) {
                                // Future versions only
                                const aFutureVersions = aItems.filter(function (v) {
                                    if (!v.Start_Date) {
                                        return false;
                                    }
                                    const dStart = new Date(v.Start_Date);
                                    dStart.setHours(0, 0, 0, 0);
                                    return dStart > today;
                                });
                                // If all versions are future dated
                                if (aFutureVersions.length === aItems.length) {
                                    oLatest = aFutureVersions.reduce(function (nearest, current) {
                                        const nearestDate = new Date(nearest.Start_Date);
                                        nearestDate.setHours(0, 0, 0, 0);
                                        const currentDate = new Date(current.Start_Date);
                                        currentDate.setHours(0, 0, 0, 0);
                                        return currentDate < nearestDate ? current : nearest;
                                    });
                                } else {
                                    // Existing functionality unchanged
                                    oLatest = aItems.reduce(function (max, item) {
                                        return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
                                    });
                                }
                            }
                            oLatest = oLatest || {};
                            return {
                                ID: oItem.ID,
                                name: oItem.PolicyName,
                                desc: oItem.PolicyDesc,
                                currentVersion: oLatest.Version || "1.0",
                                Start_Date: oLatest.Start_Date ? new Date(oLatest.Start_Date).toLocaleDateString("en-GB") : "",
                                End_Date: oLatest.End_Date && !String(oLatest.End_Date).includes("1899-11-30") ? new Date(oLatest.End_Date).toLocaleDateString("en-GB") : "",
                                File_Name: oLatest.File_Name || "",
                                File_Content: oLatest.File_Content || "",
                                File_Type: oLatest.File_Type || "",
                                UploadDate: oItem.UploadDate ? new Date(oItem.UploadDate).toLocaleDateString("en-GB") : "",
                                department: oItem.Department || "",
                                role: oItem.Role || "",
                                employeeIds: (oItem.EmployeeID || "").toString().trim(),
                                imageUrl: sImageUrl,
                                selected: false
                            };
                        }.bind(this));
                        aPolicies = await this.PL_filterPoliciesByAccess(aPolicies);
                    }
                    this.getView().setModel(new sap.ui.model.json.JSONModel({
                        policies: aPolicies
                    }), "policyModel");
                    this.getView().getModel("policyModel").refresh(true);
                } catch (oError) {
                    MessageBox.error("Failed to load policies");
                }
            },
            _getLatestVersionStartDate: function (aItems) {
                if (!Array.isArray(aItems) || aItems.length === 0) {
                    return null;
                }
                const oLatest = aItems.reduce((max, item) => {
                    const v1 = parseFloat(item.Version || "0");
                    const v2 = parseFloat(max.Version || "0");
                    return v1 > v2 ? item : max;
                });
                return oLatest.Start_Date ? new Date(oLatest.Start_Date) : null;
            },
            _getActivePolicyVersion: function (aItems) {
                const today = new Date();
                let oActive = aItems.find(v => {
                    const dStart = v.Start_Date ? new Date(v.Start_Date) : null;
                    const dEnd = v.End_Date ? new Date(v.End_Date) : null;
                    if (!dStart) return false;
                    if (!dEnd || isNaN(dEnd.getTime())) {
                        return dStart <= today;
                    }
                    return dStart <= today && today <= dEnd;
                });
                if (!oActive && aItems.length) {
                    oActive = aItems.reduce((max, item) => {
                        const v1 = item.Version || "0";
                        const v2 = max.Version || "0";
                        const a = v1.split(".").map(Number);
                        const b = v2.split(".").map(Number);
                        for (let i = 0; i < Math.max(a.length, b.length); i++) {
                            const diff = (a[i] || 0) - (b[i] || 0);
                            if (diff > 0) return item;
                            if (diff < 0) return max;
                        }
                        return max;
                    }, aItems[0]);
                }
                return oActive || {};
            },
            // FILTER ROLE BASED ON DEPARTMENT
          PL_onDepartmentChange: function (oEvent) {
    this.PL_onSelectionChangeValidation(oEvent);

    var oDepartmentCombo = oEvent.getSource();
    var sDepartment = (oDepartmentCombo.getSelectedKey() || "").trim();

    // ROLE CONTROLS
    var oRoleCreate = this.byId("PL_id_Role");
    var oRoleFilter = this.byId("PL_id_RoleFilter");
    var oRoleView = this.byId("PL_id_ViewRole");

    // CLEAR ROLE ALWAYS
    [oRoleCreate, oRoleFilter, oRoleView].forEach(function (oRole) {
        if (oRole) {
            oRole.setSelectedKey("");
            oRole.setValue("");
        }
    });

    // DEPARTMENT NOT SELECTED
    if (!sDepartment) {
        this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
        return;
    }

    // GET ALL ROLES
    var aData = this.getView().getModel("DesignationModel").getData() || [];

    // FILTER ROLE BY DEPARTMENT
    var aFilteredRoles = aData.filter(function (oItem) {
        var sItemDepartment = (oItem.department || "").trim().toLowerCase();
        return sItemDepartment === sDepartment.toLowerCase();
    });

    // REMOVE DUPLICATES
    var oUnique = {};
    var aUniqueRoles = [];

    aFilteredRoles.forEach(function (oItem) {
        var sRole = (oItem.designationName || "").trim();

        if (sRole && !oUnique[sRole]) {
            oUnique[sRole] = true;

            aUniqueRoles.push({
                designationName: sRole
            });
        }
    });

    // SET ROLE MODEL ONLY AFTER DEPARTMENT SELECTED
    this.getView().setModel(
        new JSONModel(aUniqueRoles),
        "FilteredRoleModel"
    );
},
            PL_onRemovePdf: function () {
                const oModel = this.getView().getModel("policyDialogModel");
                oModel.setProperty("/File_Content", "");
                oModel.setProperty("/File_Name", "");
                oModel.setProperty("/File_Type", "");
                this.byId("PL_id_FileUploader").clear();
                // Optional: reset value state
                this.byId("PL_id_FileUploader").setValueState("None");
            },
            PL_onRemoveLogo: function () {
                const oModel = this.getView().getModel("policyDialogModel");
                oModel.setProperty("/logoBase64", "");
                oModel.setProperty("/logoType", "");
                oModel.setProperty("/logo", "");
                oModel.setProperty("/Logo_Name", "");
                this.byId("PL_id_LogoUploader").clear();
            },
            PL_onFileUpload: function (oEvent) {
                const oFile = oEvent.getParameter("files")[0];
                if (!oFile) {
                    return; // User clicked Cancel -> keep existing file
                }
                // BLOCK NON-PDF
                if (oFile.type !== "application/pdf") {
                    MessageBox.error(this.i18nModel.getText("onlyPdfAllowed"));
                    oEvent.getSource().clear();
                    const oModel = this.getView().getModel("policyDialogModel");
                    oModel.setProperty("/File_Content", "");
                    oModel.setProperty("/File_Name", "");
                    oModel.setProperty("/File_Type", "");
                    return;
                }
                // READ FILE
                const oReader = new FileReader();
                oReader.onload = function (e) {
                    const base64 = e.target.result.split(",")[1];
                    const oModel = this.getView().getModel("policyDialogModel");
                    oModel.setProperty("/File_Content", base64);
                    oModel.setProperty("/File_Name", oFile.name);
                    oModel.setProperty("/File_Type", oFile.type);
                }.bind(this);
                oReader.readAsDataURL(oFile);
            },
            _openVersionDialog: function (oData) {
                const oModel = this.getView().getModel("policyDialogModel");
                oModel.setData({
                    policyId: oData.ID,
                    version: "",
                    UploadDate: new Date(),
                    File_Content: "",
                    File_Name: "",
                    File_Type: "",
                    isEdit: true,
                    isVersionMode: true
                });
                this._oVersionDialog.open();
            },
            // version
            PL_onNewVersion: async function (oEvent) {
                this.getBusyDialog();
                const oContext = oEvent.getSource().getBindingContext("policyModel");
                const oData = oContext.getObject();
                let sLatestVersion = "1.0";
                try {
                    const oResponse = await this.ajaxReadWithJQuery("PolicyImage", {
                        ID: oData.ID
                    });
                    let aVersions = oResponse.data?.Items || [];
                    if (!Array.isArray(aVersions)) {
                        aVersions = [aVersions];
                    }
                    if (aVersions.length > 0) {
                        const oLatest = aVersions.reduce(function (max, item) {
                            return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
                        });
                        sLatestVersion = oLatest.Version || "1.0";
                        this._latestStartDate = oLatest.Start_Date ? new Date(oLatest.Start_Date) : null;
                        if (this._latestStartDate) {
                            this._latestStartDate.setHours(0, 0, 0, 0);
                        }
                    }
                } catch (e) {
                    sLatestVersion = "1.0";
                }
                if (!this._oVersionDialog) {
                    this._oVersionDialog = sap.ui.xmlfragment("sap.kt.com.minihrsolution.fragment.PolicyVersionDialog", this);
                    this.getView().addDependent(this._oVersionDialog);
                }
                this.getView().setModel(new JSONModel({
                    Parent_Policy_ID: oData.ID,
                    PolicyName: oData.name,
                    PolicyDesc: oData.desc,
                    // latest version from DB + 0.1
                    Version: this._getNextVersion(sLatestVersion),
                    Start_Date: sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "dd/MM/yyyy"
                    }).format(new Date()),
                    File_Content: "",
                    File_Name: "",
                    File_Type: ""
                }), "policyDialogModel");
                const oUploader = sap.ui.getCore().byId("PL_id_NewVersionFile");
                if (oUploader) {
                    oUploader.clear();
                }
                this._oVersionDialog.open();
                this.closeBusyDialog();
                setTimeout(() => {
                    const oDatePicker = sap.ui.getCore().byId("PLV_id_StartDate");
                    if (oDatePicker && this._latestStartDate) {
                        oDatePicker.setMinDate(this._latestStartDate);
                    }
                }, 0);
                this._FragmentDatePickersReadOnly(["PLV_id_StartDate"]);
            },
            _getNextVersion: function (sVersion) {
                if (!sVersion) {
                    return "1.0";
                }
                const fVersion = parseFloat(sVersion);
                return (Math.round((fVersion + 0.1) * 10) / 10).toFixed(1);
            },
            PL_onVersionFileUpload: function (oEvent) {
                const oFile = oEvent.getParameter("files")[0];
                const oModel = this.getView().getModel("policyDialogModel");
                if (!oFile) {
                    return;
                }
                if (oFile.type !== "application/pdf") {
                    MessageBox.error(this.i18nModel.getText("onlyPdfAllowed"));
                    oEvent.getSource().clear();
                    oModel.setProperty("/Version_File_Content", "");
                    oModel.setProperty("/Version_File_Name", "");
                    oModel.setProperty("/Version_File_Type", "");
                    return;
                }
                const oReader = new FileReader();
                oReader.onload = function (e) {
                    const base64 = e.target.result.split(",")[1];
                    oModel.setProperty("/Version_File_Content", base64);
                    oModel.setProperty("/Version_File_Name", oFile.name);
                    oModel.setProperty("/Version_File_Type", oFile.type);
                }.bind(this);
                oReader.readAsDataURL(oFile);
            },
            PL_onRemoveVersionPdf: function () {
                const oModel = this.getView().getModel("policyDialogModel");
                // Clear model
                oModel.setProperty("/Version_File_Content", "");
                oModel.setProperty("/Version_File_Name", "");
                oModel.setProperty("/Version_File_Type", "");
                sap.ui.getCore().byId("PL_id_NewVersionFile").setValue("");
                sap.ui.getCore().byId("PL_id_NewVersionFile").setValueState("None");
            },
            PL_onSaveNewVersion: async function () {
                const oModel = this.getView().getModel("policyDialogModel");
                const oData = oModel.getData();
                const sPolicyId = oData.Parent_Policy_ID;
                if (!sPolicyId) {
                    MessageBox.error(this.i18nModel.getText("policyIdMissing"));
                    return;
                }
                // START DATE VALIDATION
                const oStartDate = sap.ui.getCore().byId("PLV_id_StartDate");
                if (!oStartDate) {
                    MessageBox.error("Start Date field not found");
                    return;
                }
                if (!Validation._LCvalidateDate(oStartDate, "ID")) {
                    oStartDate.setValueState("Error");
                    oStartDate.setValueStateText("Please enter a valid start date");
                    return;
                }
                oStartDate.setValueState("None");
                const oVersionInput = sap.ui.getCore().byId("PL_id_Version");
                if (!Validation._LCvalidateMandatoryField(oVersionInput, "ID")) {
                    oVersionInput.setValueStateText("Enter valid version (e.g. 1.0, 1.1)");
                    return;
                }
                const sVersion = oVersionInput.getValue().trim();
                // STRICT FORMAT VALIDATION
                const versionRegex = /^\d{1}\.\d{1}$/;
                if (!versionRegex.test(sVersion)) {
                    oVersionInput.setValueState("Error");
                    oVersionInput.setValueStateText("Enter valid version format (e.g. 1.0, 2.3)");
                    oVersionInput.focus();
                    return;
                } else {
                    oVersionInput.setValueState("None");
                }
                // CLEAN BASE64
                let Version_File_Content = oData.Version_File_Content || "";
                if (Version_File_Content.includes(",")) {
                    Version_File_Content = Version_File_Content.split(",")[1];
                }
                // SAFETY CHECK 
                if (!Version_File_Content) {
                    MessageBox.error("Please upload PDF file");
                    return;
                }
                if (Version_File_Content.length > 5000000) {
                    MessageBox.error("File too large. Please upload smaller PDF.");
                    return;
                }
                // SAFE DATE FORMAT 
                const formatDate = function (d) {
                    if (!d) return null;
                    const dt = new Date(d);
                    if (isNaN(dt.getTime())) return null;
                    return dt.toISOString().split("T")[0];
                };
                const oPayload = {
                    Policy_Parent_ID: sPolicyId,
                    File_Name: oData.Version_File_Name || "",
                    File_Type: oData.Version_File_Type || "application/pdf",
                    File_Content: Version_File_Content,
                    Start_Date: this._formatDateForDB(oData.Start_Date),
                    UploadDate: this._formatDateForDB(new Date()),
                    End_Date: null,
                    Version: oData.Version || "1.0"
                };
                console.log("UploadDate Sent:", oPayload.UploadDate);
console.log("Payload:", oPayload);
                try {
                    this.getBusyDialog();
                    const oResponse = await this.ajaxCreateWithJQuery("PolicyItems", {
                        data: oPayload
                    });
                    console.log("Save Success Response:", oResponse);
                    MessageToast.show(this.i18nModel.getText("versionCreatedSuccess"));
                    this._oVersionDialog.close();
                    await this.PL_loadPolicies();
                } catch (e) {
                    MessageBox.error(this.i18nModel.getText("versionAlreadyExists"));
                } finally {
                    this.closeBusyDialog();
                }
            },
            PL_onViewVersion: async function (oEvent) {
                try {
                    this.getBusyDialog();
                    const oContext = oEvent.getSource().getBindingContext("policyModel");
                    const oPolicy = oContext.getObject();
                    const sPolicyId = oPolicy.ID;
                    if (!sPolicyId) {
                        MessageBox.error(this.i18nModel.getText("policyIdMissing"));
                        return;
                    }
                    const oRequest = {
                        ID: sPolicyId
                    };
                    const oResponse = await this.ajaxReadWithJQuery("PolicyImage", oRequest);
                    if (!oResponse || !oResponse.success) {
                        MessageBox.error(oResponse?.message || "Failed to load versions");
                        return;
                    }
                    let aVersions = oResponse.data?.Items || [];
                    if (!Array.isArray(aVersions)) {
                        aVersions = [aVersions];
                    }
                    // Normalize
                    aVersions = aVersions.map(v => ({
                        Version: v.Version || "",
                        Start_Date: v.Start_Date ? new Date(v.Start_Date) : null,
                        End_Date: (v.End_Date && v.End_Date !== "1899-11-30T00:00:00.000Z") ? new Date(v.End_Date) : "",
                        File_Name: v.File_Name || "",
                        File_Type: v.File_Type || "",
                        File_Content: v.File_Content || ""
                    }));
                    // Sort latest first
                    aVersions.sort((a, b) => parseFloat(b.Version || 0) - parseFloat(a.Version || 0));
                    const oVersionModel = new sap.ui.model.json.JSONModel({
                        PolicyTitle: oPolicy.name,
                        versions: aVersions
                    });
                    this.getView().setModel(oVersionModel, "versionModel");
                    if (!this._oVersionHistoryDialog) {
                        this._oVersionHistoryDialog = await sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.PolicyVersionHistory",
                            controller: this
                        });
                        this.getView().addDependent(this._oVersionHistoryDialog);
                    }
                    this._oVersionHistoryDialog.open();
                } catch (e) {
                    MessageBox.error(this.i18nModel.getText("versionLoadFailed"));
                } finally {
                    this.closeBusyDialog();
                }
            },
            onCloseVersionHistory: function () {
                if (this._oVersionHistoryDialog) {
                    this._oVersionHistoryDialog.close();
                }
            },
            onCloseVersionHistory: function () {
                if (this._oVersionHistoryDialog) {
                    this._oVersionHistoryDialog.close();
                }
            },
            onDownloadVersionPdf: function (oEvent) {
                const oData = oEvent.getSource().getBindingContext("versionModel").getObject();
                if (!oData.File_Content) return MessageBox.error(this.i18nModel.getText("noPdfFound"));
                const sPdf = "data:application/pdf;base64," + oData.File_Content;
                const link = document.createElement("a");
                link.href = sPdf;
                link.download = oData.File_Name || "version.pdf";
                link.click();
            },
            PL_onCancelNewVersion: function () {
                // CLEAR FILE UPLOADER
                const oUploader = sap.ui.getCore().byId("PL_id_NewVersionFile");
                if (oUploader) {
                    oUploader.clear();
                    oUploader.setValueState("None");
                }
                // CLEAR START DATE ERROR
                const oStartDate = sap.ui.getCore().byId("PLV_id_StartDate");
                if (oStartDate) {
                    oStartDate.setValueState("None");
                    oStartDate.setValueStateText("");
                }
                // CLEAR VERSION ERROR
                const oVersion = sap.ui.getCore().byId("PL_id_Version");
                if (oVersion) {
                    oVersion.setValueState("None");
                    oVersion.setValueStateText("");
                }
                if (this._oVersionDialog) {
                    this._oVersionDialog.close();
                }
                this.getView().setModel(new JSONModel({}), "policyDialogModel");
            },
            // CREATE
            PL_onCreatePress: function () {
                const oToday = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "dd/MM/yyyy"
                }).format(new Date());
                const oDialogModel = new JSONModel({
                    ID: "",
                    title: "",
                    description: "",
                    department: "",
                    role: "",
                    Start_Date: oToday,
                    UploadDate: oToday,
                    // LOGO (FIXED SAFE RESET)
                    logoBase64: null,
                    logoType: "",
                    logo: "",
                    // PDF
                    File_Content: "",
                    File_Name: "",
                    File_Type: "",
                    isEdit: false,
                });
                this.getView().setModel(oDialogModel, "policyDialogModel");
                //  IMPORTANT FIX (forces UI5 binding refresh clean)
                this.getView().getModel("policyDialogModel").refresh(true);
                this.getView().setModel(
    new JSONModel([]),
    "FilteredRoleModel"
);
                this.PL_openDialog();
            },
            // OPEN DIALOG
            PL_openDialog: function () {
                if (this.FPL_oDialog) {
                    this.FPL_oDialog.open();
                    return;
                }
                if (this._bPolicyDialogLoading) return;
                this._bPolicyDialogLoading = true;
                Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PolicyDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.FPL_oDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    this._bPolicyDialogLoading = false;
                    oDialog.open();
                    this._FragmentDatePickersReadOnly([
                        this.getView().createId("PL_id_StartDate"),
                        this.getView().createId("PL_id_UploadDate")
                    ]);
                }.bind(this)).catch(function (oError) {
                    this._bPolicyDialogLoading = false;
                }.bind(this));
            },
            // live validation
            // REMOVE ERROR FOR INPUT
            PL_onLiveChangeValidation: function (oEvent) {
                var oField = oEvent.getSource();
                var sValue = oField.getValue().trim();
                if (sValue) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                }
            },
            // REMOVE ERROR FOR SELECT
            PL_onSelectionChangeValidation: function (oEvent) {
                var oField = oEvent.getSource();
                var sKey = oField.getSelectedKey();
                if (sKey) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                }
            },
            // REMOVE ERROR FOR DATE
            PL_onDateValidation: function (oEvent) {
                var oField = oEvent.getSource();
                var sValue = oField.getValue().trim();
                if (this._latestStartDate) {
                    const oDate = oEvent.getSource().getDateValue();
                    if (oDate && oDate < this._latestStartDate) {
                        oEvent.getSource().setValueState("Error");
                        oEvent.getSource().setValueStateText("Start date cannot be before latest version start date");
                        return;
                    }
                }
                // EMPTY VALUE
                if (!sValue) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                    return;
                }
                // VALID DATE
                if (Validation._LCvalidateDate(oField, "ID")) {
                    // REMOVE RED ERROR
                    oField.setValueState("None");
                    oField.setValueStateText("");
                } else {
                    // INVALID DATE
                    oField.setValueState("Error");
                }
            },
            // SAVE
          PL_onSavePolicy: async function () {
    try {
        // TITLE VALIDATION
        if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_Title"), "ID",)) {
            this.byId("PL_id_Title").setValueState("Error");
            this.byId("PL_id_Title").setValueStateText("Policy title is required");
            return;
        }

        // DESCRIPTION VALIDATION
        if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_Description"), "ID",)) {
            this.byId("PL_id_Description").setValueState("Error");
            this.byId("PL_id_Description").setValueStateText("Please enter policy description");
            return;
        }

        // DEPARTMENT VALIDATION
        if (!Validation._LCstrictValidationComboBox(this.byId("PL_id_Department"), "ID")) {
            this.byId("PL_id_Department").setValueState("Error");
            this.byId("PL_id_Department").setValueStateText("Please select a valid department");
            return;
        }

        // ROLE VALIDATION
        if (!Validation._LCstrictValidationComboBox(this.byId("PL_id_Role"), "ID")) {
            this.byId("PL_id_Role").setValueState("Error");
            this.byId("PL_id_Role").setValueStateText("Please select a valid role");
            return;
        }

        // MODEL DATA
        const oData = this.getView().getModel("policyDialogModel").getData();

        // PDF VALIDATION
        if (!oData.File_Content) {
            MessageBox.error(this.i18nModel.getText("policyPdfRequired"));
            return;
        }

        // START DATE VALIDATION
        if (!Validation._LCvalidateDate(this.byId("PL_id_StartDate"), "ID")) {
            this.byId("PL_id_StartDate").setValueState("Error");
            this.byId("PL_id_StartDate").setValueStateText("Please enter a valid start date");
            return;
        }

        // CREATE DATE VALIDATION
        if (!Validation._LCvalidateDate(this.byId("PL_id_UploadDate"), "ID")) {
            this.byId("PL_id_UploadDate").setValueState("Error");
            this.byId("PL_id_UploadDate").setValueStateText("Please enter a valid date");
            return;
        }

        const sStartDate = oData.Start_Date;
        const dStartDate = new Date(sStartDate.split("/").reverse().join("-"));
        const dToday = new Date();
        dToday.setHours(0, 0, 0, 0);
        dStartDate.setHours(0, 0, 0, 0);

        if (dStartDate < dToday) {
            this.byId("PL_id_StartDate").setValueState("Error");
            this.byId("PL_id_StartDate").setValueStateText(this.i18nModel.getText("startDatePastNotAllowed"));
            MessageBox.error(this.i18nModel.getText("startDatePastNotAllowed"));
            return;
        }

        // PAYLOAD
        const oPayloadData = {
            EmployeeID: "",
            PolicyName: oData.title,
            PolicyDesc: oData.description,
            Department: oData.department || "",
            Role: oData.role || "",
            Start_Date: oData.Start_Date.split('/').reverse().join('-'),
            UploadDate: oData.UploadDate.split('/').reverse().join('-'),
            File_Content: oData.File_Content,
            File_Name: oData.File_Name,
            File_Type: oData.File_Type,
            Logo: oData.logoBase64 || "",
        };

        // BUSY DIALOG
        this.getBusyDialog();

        // CLEAR FILE UPLOADERS
        var aUploaders = this.getView().findAggregatedObjects(true, function (oControl) {
            return oControl.isA("sap.ui.unified.FileUploader");
        });

        aUploaders.forEach(function (oUploader) {
            oUploader.clear();
        });

        // UPDATE / CREATE
        if (oData.isEdit) {
            const oUpdatePayload = {
                filters: {
                    ID: oData.ID,
                },
                data: oPayloadData,
            };
            await this.ajaxUpdateWithJQuery("Policy", oUpdatePayload);
        } else {
            await this.ajaxCreateWithJQuery("Policy", {
                data: oPayloadData,
            });
        }

        // SUCCESS MESSAGE
        MessageToast.show(this.i18nModel.getText("policyCreateSuccess"));

        // CLOSE DIALOG
        if (this.FPL_oDialog) {
            this.FPL_oDialog.close();
        }

        // ===================== 🔥 FIX ADDED HERE =====================
        // RESET ROLE + DEPENDENCY STATE AFTER SAVE

        this.getView().setModel(new JSONModel({
            ID: "",
            title: "",
            description: "",
            department: "",
            role: "",
            logoBase64: "",
            logoType: "",
            logo: "",
            File_Content: "",
            File_Name: "",
            File_Type: "",
            isEdit: false
        }), "policyDialogModel");

        this.getView().setModel(new JSONModel([]), "FilteredRoleModel");

        var oDept = this.byId("PL_id_Department");
        var oRole = this.byId("PL_id_Role");

        if (oDept) {
            oDept.setSelectedKey("");
            oDept.setValue("");
        }

        if (oRole) {
            oRole.setSelectedKey("");
            oRole.setValue("");
        }

        var oRoleFilter = this.byId("PL_id_RoleFilter");
        if (oRoleFilter) {
            oRoleFilter.setSelectedKey("");
            oRoleFilter.setValue("");
        }

        // ===========================================================

        // REFRESH POLICIES BASED ON CURRENT FILTERS
        const sSearch = this.byId("PL_id_SearchPolicy")?.getValue()?.trim() || "";
        const sDepartment = this.byId("PL_id_DepartmentFilter")?.getSelectedKey()?.trim() || "";
        const sRole = this.byId("PL_id_RoleFilter")?.getSelectedKey()?.trim() || "";

        try {
            if (sSearch || sDepartment || sRole) {
                await this.PL_onSearchPolicy();
            } else {
                await this.PL_loadPolicies();
            }

            const oPolicyModel = this.getView().getModel("policyModel");
            if (oPolicyModel) {
                oPolicyModel.refresh(true);
            }
        } catch (oRefreshError) { }

        // CLOSE BUSY
        this.closeBusyDialog();

    } catch (oError) {
        this.closeBusyDialog();
        MessageBox.error(oError.message || "Save failed");
    }
},
            // CANCEL
           PL_onCancelPolicy: function () {

    // RESET MODEL
    this.getView().setModel(new JSONModel({
        ID: "",
        title: "",
        description: "",
        department: "",
        role: "",
        logoBase64: "",
        logoType: "",
        logo: "",
        File_Content: "",
        File_Name: "",
        File_Type: "",
        isEdit: false,
       
    }), "policyDialogModel");

    // ❌ RESET VALIDATION STATES
    this.byId("PL_id_Title").setValueState("None");
    this.byId("PL_id_Description").setValueState("None");
    this.byId("PL_id_Department").setValueState("None");
    this.byId("PL_id_Role").setValueState("None");

    // 🔥 IMPORTANT: CLEAR DEPENDENCY (ROLE LIST)
    this.getView().setModel(new JSONModel([]), "FilteredRoleModel");

    // 🔥 RESET COMBOBOX VALUES (CRITICAL)
    var oDept = this.byId("PL_id_Department");
    var oRole = this.byId("PL_id_Role");

    if (oDept) {
        oDept.setSelectedKey("");
        oDept.setValue("");
    }

    if (oRole) {
        oRole.setSelectedKey("");
        oRole.setValue("");
    }

    // CLEAR FILE UPLOADERS
    var aUploaders = this.getView().findAggregatedObjects(true, function (oControl) {
        return oControl.isA("sap.ui.unified.FileUploader");
    });

    aUploaders.forEach(function (oUploader) {
        oUploader.clear();
    });

    var oLogoUploader = this.byId("PL_id_LogoUploader");
    if (oLogoUploader) {
        oLogoUploader.clear();
    }

    // CLOSE DIALOG
    if (this.FPL_oDialog) {
        this.FPL_oDialog.close();
    }
},
            // LOGO UPLOAD
            PL_onLogoUpload: function (oEvent) {
                const oModel = this.getView().getModel("policyDialogModel");
                const aFiles = oEvent.getParameter("files");
                if (!aFiles || aFiles.length === 0) {
                    // Remove logo data from model
                    oModel.setProperty("/logoBase64", "");
                    oModel.setProperty("/logoType", "");
                    oModel.setProperty("/logo", "");
                    oModel.setProperty("/Logo_Name", "");
                    this.byId("PL_id_LogoUploader").clear();
                    return;
                }
                const oFile = aFiles[0];
                // Remove old logo only when a new file is selected
                oModel.setProperty("/logoBase64", "");
                oModel.setProperty("/logoType", "");
                oModel.setProperty("/logo", "");
                if (!oFile.type.startsWith("image/")) {
                    MessageBox.error("Only images allowed");
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64 = e.target.result.split(",")[1];
                    oModel.setProperty("/logoBase64", base64);
                    oModel.setProperty("/logoType", oFile.type);
                    oModel.setProperty("/Logo_Name", oFile.name);
                }.bind(this);
                reader.readAsDataURL(oFile);
            },
            // LOGO TYPE VALIDATION
            PL_onLogoTypeMissmatch: function () {
                MessageBox.error(this.i18nModel.getText("onlyImagesAllowed"));
            },
            // LOGO SIZE EXCEED
            PL_onLogoSizeExceed: function () {
                MessageBox.error(this.i18nModel.getText("logoSizeExceeded"));
            },
            PL_onViewPolicy: async function (oEvent) {
                this._applyStartDateStyle();
                const oObject = oEvent.getSource().getBindingContext("policyModel").getObject();
                this._selectedPolicyId = oObject.ID;
                try {
                    this.getBusyDialog();
                    const [oResponse, oPolicyResponse] = await Promise.all([
                        this.ajaxReadWithJQuery("PolicyImage", {
                            ID: oObject.ID,
                            Parent_Policy_ID: oObject.ID
                        }),
                        this.ajaxReadWithJQuery("Policy", {
                            ID: oObject.ID
                        })
                    ]);
                    if (!oResponse || !oResponse.success) {
                        this.closeBusyDialog();
                        MessageBox.error("No PDF data found");
                        return;
                    }
                    let oPolicyData = Array.isArray(oResponse.data) ? oResponse.data[0] : oResponse.data;
                    const aItems = oPolicyData?.Items || [];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    //  ACTIVE VERSION 
                    let activeVersions = [];
                    // DO NOT declare today again — reuse existing one
                    for (let i = 0; i < aItems.length; i++) {
                        const v = aItems[i];
                        const dStart = v.Start_Date ? new Date(v.Start_Date) : null;
                        const dEnd = v.End_Date ? new Date(v.End_Date) : null;
                        if (!dStart) continue;
                        dStart.setHours(0, 0, 0, 0);
                        const isNoEnd = !v.End_Date || v.End_Date === "1899-11-30T00:00:00.000Z" || isNaN(dEnd?.getTime());
                        if (!isNoEnd && dEnd) {
                            dEnd.setHours(0, 0, 0, 0);
                        }
                        const isActive = dStart <= today && (isNoEnd || today <= dEnd);
                        if (isActive) {
                            activeVersions.push(v);
                        }
                    }
                    // pick latest active version
                    let oSelectedVersion = null;
                    if (activeVersions.length > 0) {
                        oSelectedVersion = activeVersions.reduce((max, item) => {
                            const v1 = String(item.Version || "0").split(".").map(Number);
                            const v2 = String(max.Version || "0").split(".").map(Number);
                            for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
                                const diff = (v1[i] || 0) - (v2[i] || 0);
                                if (diff > 0) return item;
                                if (diff < 0) return max;
                            }
                            return max;
                        }, activeVersions[0]);
                    }
                    // Fallback if no active version found
                    if (!oSelectedVersion && aItems.length > 0) {
                        oSelectedVersion = aItems.reduce((latest, item) => {
                            const v1 = parseFloat(item.Version || "0");
                            const v2 = parseFloat(latest.Version || "0");
                            return v1 > v2 ? item : latest;
                        }, aItems[0]);
                    }
                    oSelectedVersion = oSelectedVersion || {};
                    //  BASE64 
                    let sBase64 = "";
                    if (typeof oSelectedVersion?.File_Content === "string") {
                        sBase64 = oSelectedVersion.File_Content;
                    } else if (oSelectedVersion?.File_Content?.data) {
                        const uint8Array = new Uint8Array(oSelectedVersion.File_Content.data);
                        sBase64 = btoa(Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join(""));
                    }
                    // EXTRA FALLBACK
                    if (!sBase64 && aItems.length > 0) {
                        const oFirstItem = aItems[0];
                        if (typeof oFirstItem.File_Content === "string") {
                            sBase64 = oFirstItem.File_Content;
                        } else if (oFirstItem.File_Content?.data) {
                            const uint8Array = new Uint8Array(oFirstItem.File_Content.data);
                            sBase64 = btoa(Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join(""));
                        }
                    }
                    if (!sBase64) {
                        this.closeBusyDialog();
                        MessageBox.error(this.i18nModel.getTest("pdfEmpty"));
                        return;
                    }
                    sBase64 = String(sBase64).replace(/^data:.*;base64,/, "").replace(/\s/g, "");
                    if (!sBase64.startsWith("JVBER")) {
                        this.closeBusyDialog();
                        MessageBox.error(this.i18nModel.getText("invalidPdf"));
                        return;
                    }
                    this._policyPdfUrl = "data:application/pdf;base64," + sBase64;
                    // ACKNOWLEDGEMENT 
                    const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
                    let sAckIds = "";
                    if (Array.isArray(oPolicyResponse.data)) {
                        sAckIds = oPolicyResponse.data[0]?.EmployeeID || "";
                    } else {
                        sAckIds = oPolicyResponse.data?.EmployeeID || "";
                    }
                    const aAckIds = String(sAckIds).split(",").map(id => id.trim()).filter(Boolean);
                    const bAlreadyAcknowledged = aAckIds.includes(sEmployeeId);
                    //  MODEL
                    const oViewModel = new sap.ui.model.json.JSONModel({
                        title: oObject.name,
                        description: oObject.desc,
                        UploadDate: oObject.UploadDate || "",
                        department: oObject.department || oObject.Department || "",
                        role: oObject.role || oObject.Role || "",
                        Version: oSelectedVersion.Version || "",
                        Start_Date: oSelectedVersion.Start_Date ? new Date(oSelectedVersion.Start_Date).toLocaleDateString("en-GB") : "",
                        File_Name: oSelectedVersion.File_Name || "Policy.pdf",
                        File_Type: "application/pdf",
                        fileUrl: this._policyPdfUrl,
                        fullScreen: false,
                        acknowledged: false,
                        employeeIds: sAckIds,
                        alreadyAcknowledged: bAlreadyAcknowledged
                    });
                    this.getView().setModel(oViewModel, "policyViewModel");
                    this.closeBusyDialog();
                    this.PL_openViewDialog();
                } catch (e) {
                    this.closeBusyDialog();
                    MessageBox.error(this.i18nModel.getText("policyPdfLoadFailed"));
                }
            },
            onAcknowledgeCheck: function (oEvent) {
                const bSelected = oEvent.getParameter("selected");
                this.getView().getModel("policyViewModel").setProperty("/acknowledged", bSelected);
            },
            onPressAcknowledge: function () {
                const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
                const oViewModel = this.getView().getModel("policyViewModel");
                // EXISTING IDS
                let sExistingIds = oViewModel.getProperty("/employeeIds") || "";
                let aIds = sExistingIds ? sExistingIds.split(",") : [];
                aIds = aIds.map(function (id) {
                    return id.trim();
                }).filter(Boolean);
                // ADD EMPLOYEE ONLY ONCE
                if (!aIds.includes(sEmployeeId)) {
                    aIds.push(sEmployeeId);
                }
                const sFinalIds = aIds.join(",");
                MessageBox.confirm(this.i18nModel.getText("policyAcknowledgeConfirm"), {
                    title: "Confirmation",
                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.YES) {
                            oViewModel.setProperty("/acknowledged", false);
                            return;
                        }
                        this.getBusyDialog();
                        this.ajaxUpdateWithJQuery("Policy", {
                            filters: {
                                ID: this._selectedPolicyId
                            },
                            data: {
                                EmployeeID: sFinalIds
                            }
                        }).then(async function () {
                            // UPDATE LOCAL MODEL
                            oViewModel.setProperty("/employeeIds", sFinalIds);
                            oViewModel.setProperty("/alreadyAcknowledged", true);
                            oViewModel.setProperty("/acknowledged", false);
                            oViewModel.refresh(true);
                            // VERIFY DATABASE VALUE
                            const oCheck = await this.ajaxReadWithJQuery("Policy", {
                                ID: this._selectedPolicyId
                            });
                            this.closeBusyDialog();
                            MessageToast.show(this.i18nModel.getText("policyAcknowledgeSuccess"));
                            if (this.FPL_oViewDialog) {
                                this.FPL_oViewDialog.close();
                            }
                        }.bind(this)).catch(function (oError) {
                            this.closeBusyDialog();
                            MessageBox.error(this.i18nModel.getText("policyAcknowledgeFailed"));
                        }.bind(this));
                    }.bind(this)
                });
            },
            _createPdfIframe: function () {
                const sPdfUrl = this.getView().getModel("policyViewModel").getProperty("/fileUrl");
                const oHtml = this.byId("pdfFrame");
                const sIframe = "<iframe " + "src='" + sPdfUrl + "#toolbar=0&navpanes=0&scrollbar=0' " + "width='100%' " + "height='100%' " + "style='" + "border:none;" + "width:100%;" + "height:100vh;" + "display:block;" + "' " + "allowfullscreen>" + "</iframe>";
                oHtml.setContent(sIframe);
            },
            PL_openViewDialog: function () {
                this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
                this.getBusyDialog();
                const fnLoadPdf = function () {
                    setTimeout(function () {
                        this._createPdfIframe();
                    }.bind(this), 0);
                }.bind(this);
                const fnRefreshPolicyData = async function () {
                    try {
                        const oPolicyResponse = await this.ajaxReadWithJQuery("Policy", {
                            ID: this._selectedPolicyId,
                        });
                        const oData = Array.isArray(oPolicyResponse.data) ? oPolicyResponse.data[0] : oPolicyResponse.data || {};
                        // ACKNOWLEDGEMENT LOGIC
                        let sAckIds = oData.EmployeeID || "";
                        const aAckIds = String(sAckIds).split(",").map(id => id.trim()).filter(Boolean);
                        const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
                        const bAlreadyAcknowledged = aAckIds.includes(sEmployeeId);
                        const oModel = this.getView().getModel("policyViewModel");
                        oModel.setProperty("/employeeIds", sAckIds);
                        oModel.setProperty("/alreadyAcknowledged", bAlreadyAcknowledged);
                        oModel.refresh(true);
                        //  ACTIVE VERSION (ONLY ONE SOURCE)
                        const aItems = oData.Items || [];
                        const oActiveItem = this._getActivePolicyItem(aItems);
                        //  PDF FROM ACTIVE VERSION ONLY
                        let sBase64 = oActiveItem?.File_Content || "";
                        sBase64 = String(sBase64).replace(/^data:.*;base64,/, "").replace(/\s/g, "");
                        this._policyPdfUrl = "data:application/pdf;base64," + sBase64;
                        oModel.setProperty("/fileUrl", this._policyPdfUrl);
                    } catch (e) { }
                }.bind(this);
                if (this.FPL_oViewDialog) {
                    this.FPL_oViewDialog.open();
                    Promise.all([
                        fnRefreshPolicyData(),
                        fnLoadPdf(),
                    ]).finally(() => {
                        this.closeBusyDialog();
                    });
                    return;
                }
                Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PolicyViewDialog",
                    controller: this,
                }).then(function (oDialog) {
                    this.FPL_oViewDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                    //  pdf name should visible in maximize size code 
                    // setInterval(function () {
                    //     var oChartContainer = this.byId("PL_id_PdfChartContainer");
                    //     var oTitle = this.byId("PL_id_PdfFileName");
                    //     if (oChartContainer && oTitle) {
                    //         oTitle.setVisible(
                    //             oChartContainer.getFullScreen()
                    //         );
                    //     }
                    // }.bind(this), 500);
                    Promise.all([
                        fnRefreshPolicyData(),
                        fnLoadPdf(),
                    ]).finally(() => {
                        this.closeBusyDialog();
                    });
                }.bind(this));
            },
            _getActivePolicyItem: function (aItems) {
                if (!Array.isArray(aItems) || aItems.length === 0) {
                    return null;
                }
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // STEP 1: get all active items
                const activeItems = aItems.filter((item) => {
                    const dStart = item.Start_Date ? new Date(item.Start_Date) : null;
                    const isNoEnd = !item.End_Date || item.End_Date === "1899-11-30T00:00:00.000Z";
                    const dEnd = isNoEnd ? null : new Date(item.End_Date);
                    if (dStart) {
                        dStart.setHours(0, 0, 0, 0);
                    }
                    if (dEnd) {
                        dEnd.setHours(0, 0, 0, 0);
                    }
                    return (dStart && dStart <= today && (!dEnd || today <= dEnd));
                });
                // ACTIVE VERSION EXISTS
                if (activeItems.length > 0) {
                    activeItems.sort((a, b) => {
                        return parseFloat(b.Version || "0") - parseFloat(a.Version || "0");
                    });
                    return activeItems[0];
                }
                // CHECK FUTURE VERSIONS
                const futureItems = aItems.filter(item => {
                    if (!item.Start_Date) {
                        return false;
                    }
                    const dStart = new Date(item.Start_Date);
                    dStart.setHours(0, 0, 0, 0);
                    return dStart > today;
                });
                // ALL AVAILABLE VERSIONS ARE FUTURE
                if (futureItems.length > 0) {
                    futureItems.sort((a, b) => {
                        const aDate = new Date(a.Start_Date);
                        const bDate = new Date(b.Start_Date);
                        return aDate - bDate; // nearest future date first
                    });
                    return futureItems[0];
                }
                // OTHERWISE SHOW HIGHEST VERSION
                aItems.sort((a, b) => {
                    return parseFloat(b.Version || "0") - parseFloat(a.Version || "0");
                });
                return aItems[0];
            },
            // go button 
          PL_onSearchPolicy: async function () {
    try {
        this.getBusyDialog();

        const sSearch = this.byId("PL_id_SearchPolicy")?.getValue()?.trim() || "";
        const sDepartment = this.byId("PL_id_DepartmentFilter")?.getSelectedKey()?.trim() || "";
        const sRole = this.byId("PL_id_RoleFilter")?.getSelectedKey()?.trim() || "";

        const oResponse = await this.ajaxReadWithJQuery("Policy", {
            PolicyName: sSearch,
            Department: sDepartment,
            Role: sRole,
        });

        let aPolicies = [];

        if (oResponse && oResponse.success && oResponse.data) {

            aPolicies = oResponse.data.map((oItem) => {

                let sImageUrl = "sap-icon://person-placeholder";

                if (oItem.Logo) {
                    if (typeof oItem.Logo === "string") {
                        sImageUrl = "data:image/png;base64," + oItem.Logo;
                    } else if (oItem.Logo.data) {
                        const sBase64 = new TextDecoder().decode(
                            new Uint8Array(oItem.Logo.data)
                        );
                        sImageUrl = "data:image/png;base64," + sBase64;
                    }
                }

                const oActiveItem = this._getActivePolicyItem(oItem.Items || []);

                return {
                    ID: oItem.ID,
                    name: oItem.PolicyName,
                    desc: oItem.PolicyDesc,
                    UploadDate: oItem.UploadDate
                        ? new Date(oItem.UploadDate).toLocaleDateString("en-GB")
                        : "",
                    Start_Date: oItem.Start_Date
                        ? new Date(oItem.Start_Date).toLocaleDateString("en-GB")
                        : "",
                    department: oItem.Department || "",
                    role: oItem.Role || "",
                    currentVersion: oActiveItem?.Version || "1.0",
                    employeeIds: (oItem.EmployeeID || "").toString().trim(),
                    imageUrl: sImageUrl,
                    File_Content: oItem.File_Content || "",
                    File_Name: oItem.File_Name,
                    File_Type: oItem.File_Type,
                    selected: false,
                };
            });

            aPolicies = await this.PL_filterPoliciesByAccess(aPolicies);
        }

        this.getView().getModel("policyModel").setProperty("/policies", aPolicies);

    } catch (oError) {
        console.error("PL_onSearchPolicy Error:", oError);
        MessageBox.error(this.i18nModel.getText("loadPoliciesFailed"));
    } finally {
        this.closeBusyDialog();
    }
},
            PL_onClearPolicy: function () {
                // SEARCH
                this.byId("PL_id_SearchPolicy").setValue("");
                // DEPARTMENT
                this.byId("PL_id_DepartmentFilter").setSelectedKey("");
                // ROLE
                this.byId("PL_id_RoleFilter").setSelectedKey("");
            },
         PL_onLiveSearchPolicy: function (oEvent) {
    const sValue = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
    const oModel = this.getView().getModel("policyModel");

    // safety fallback
    if (!this._aAllPolicies) {
        this._aAllPolicies = oModel.getProperty("/policies") || [];
    }

    let aFilteredPolicies = [];

    // ✅ IMPORTANT: EMPTY SEARCH = RESTORE FULL DATA
    if (!sValue) {
        aFilteredPolicies = this._aAllPolicies;
    } else {
        aFilteredPolicies = this._aAllPolicies.filter(function (oPolicy) {
            return (
                (oPolicy.name && oPolicy.name.toLowerCase().includes(sValue)) ||
                (oPolicy.desc && oPolicy.desc.toLowerCase().includes(sValue))
            );
        });
    }

    oModel.setProperty("/policies", aFilteredPolicies);
},
            PL_onPressEditAndSave: function (oEvent) {
                debugger;
                if (oEvent.getSource().getText() === "Edit") {
                    this.onPressEdit();
                } else {
                    this.onPressSave();
                }
            },
            _updateRoleModel: function (sDepartment) {
                var aData = this.getView().getModel("DesignationModel").getData() || [];
                var aFilteredRoles = aData.filter(function (oItem) {
                    return (oItem.department || "").trim().toLowerCase() === sDepartment.toLowerCase();
                });
                var oUnique = {};
                var aUniqueRoles = [];
                aFilteredRoles.forEach(function (oItem) {
                    var sRole = (oItem.designationName || "").trim();
                    if (sRole && !oUnique[sRole]) {
                        oUnique[sRole] = true;
                        aUniqueRoles.push({
                            designationName: sRole
                        });
                    }
                });
                this.getView().setModel(new JSONModel(aUniqueRoles), "FilteredRoleModel");
            },
            onPressEdit: function () {
                // SWITCH TO EDIT MODE
                this.getView().getModel("VisibleModel").setProperty("/EditBtn", false);
                // GET CURRENT POLICY DATA
                var oPolicyModel = this.getView().getModel("policyViewModel");
                var sDepartment = (oPolicyModel.getProperty("/department") || "").trim();
                // UPDATE ROLE MODEL BASED ON DEPARTMENT
                if (sDepartment) {
                    this._updateRoleModel(sDepartment);
                }
                // OPTIONAL: FORCE UI UPDATE (SAFETY)
                var oRoleCombo = this.byId("PL_id_ViewRole");
                if (oRoleCombo && oRoleCombo.getBinding("items")) {
                    oRoleCombo.getBinding("items").refresh();
                }
                // APPLY UI STYLE FOR EDIT MODE
                this._applyStartDateStyle();
            },
            onPressSave: async function () {
                // TITLE VALIDATION
                if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_ViewTitle"), "ID")) {
                    this.byId("PL_id_ViewTitle").setValueState("Error");
                    this.byId("PL_id_ViewTitle").setValueStateText("Policy title is required");
                    return;
                }
                // DESCRIPTION VALIDATION
                if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_ViewDescription"), "ID")) {
                    this.byId("PL_id_ViewDescription").setValueState("Error");
                    this.byId("PL_id_ViewDescription").setValueStateText("Please enter policy description");
                    return;
                }
                // DEPARTMENT VALIDATION
                if (!Validation._LCstrictValidationComboBox(this.byId("PL_id_ViewDepartment"), "ID")) {
                    this.byId("PL_id_ViewDepartment").setValueState("Error");
                    this.byId("PL_id_ViewDepartment").setValueStateText("Please select a valid department");
                    return;
                }
                // ROLE VALIDATION
                if (!Validation._LCstrictValidationComboBox(this.byId("PL_id_ViewRole"), "ID")) {
                    this.byId("PL_id_ViewRole").setValueState("Error");
                    this.byId("PL_id_ViewRole").setValueStateText("Please select a valid role");
                    return;
                }
                // MODEL DATA
                const oModel = this.getView().getModel("policyViewModel");
                const oData = oModel.getData();
                // UPDATE PAYLOAD
                const oPayload = {
                    filters: {
                        ID: this._selectedPolicyId,
                    },
                    data: {
                        PolicyName: oData.title,
                        PolicyDesc: oData.description,
                        Department: oData.department,
                        Role: oData.role,
                    },
                };
                try {
                    // BUSY START
                    this.getBusyDialog();
                    // UPDATE POLICY
                    await this.ajaxUpdateWithJQuery("Policy", oPayload);
                    const sSearch = this.byId("PL_id_SearchPolicy").getValue().trim();
                    const sDepartment = this.byId("PL_id_DepartmentFilter").getValue().trim();
                    const sRole = this.byId("PL_id_RoleFilter").getValue().trim();
                    if (sSearch || sDepartment || sRole) {
                        await this.PL_onSearchPolicy();
                    } else {
                        await this.PL_loadPolicies();
                    }
                    const oPolicyModel = this.getView().getModel("policyModel");
                    if (oPolicyModel) {
                        oPolicyModel.refresh(true);
                    }
                    // ENABLE EDIT BUTTON
                    this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
                    // APPLY UI STYLE FOR EDIT MODE
                    this._applyStartDateStyle();
                    // CLOSE DIALOG
                    if (this.FPL_oViewDialog) {
                        this.FPL_oViewDialog.close();
                    }
                    // BUSY CLOSE
                    this.closeBusyDialog();
                    // SUCCESS MESSAGE
                    MessageToast.show(this.i18nModel.getText("policyUpdatedSuccess"));
                } catch (oError) {
                    this.closeBusyDialog();
                    MessageBox.error(this.i18nModel.getText("updateFailed"));
                }
            },
            // FORMAT DATE FOR DB
            _formatDateForDB: function (sDate) {
                if (!sDate) return null;
                const d = new Date(sDate);
                if (isNaN(d.getTime())) {
                    return null;
                }
                return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
            },
            onPressback: function () {
                this.getRouter().navTo("RouteTilePage");
            },
            onLogout: function () {
                this.CommonLogoutFunction();
            },
            // view dialog close
            PL_onCloseViewDialog: function () {
                this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
                // REMOVE VALUE STATE ERRORS
                if (this.byId("PL_id_ViewTitle")) {
                    this.byId("PL_id_ViewTitle").setValueState("None");
                }
                if (this.byId("PL_id_ViewDescription")) {
                    this.byId("PL_id_ViewDescription").setValueState("None");
                }
                if (this.byId("PL_id_ViewDepartment")) {
                    this.byId("PL_id_ViewDepartment").setValueState("None");
                }
                if (this.byId("PL_id_ViewRole")) {
                    this.byId("PL_id_ViewRole").setValueState("None");
                }
                if (this.byId("PL_id_ViewUploadDate")) {
                    this.byId("PL_id_ViewUploadDate").setValueState("None");
                }
                if (this.FPL_oViewDialog) {
                    this.FPL_oViewDialog.close();
                }
            },
        },);
    },);
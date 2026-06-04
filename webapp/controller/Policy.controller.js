sap.ui.define(
 ["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/core/Fragment", "sap/m/MessageBox", "sap/m/MessageToast", "../utils/validation", "../model/formatter", ],
 function(BaseController, JSONModel, Fragment, MessageBox, MessageToast, Validation, formatter, ) {
  "use strict";
  return BaseController.extend("sap.kt.com.minihrsolution.controller.Policy", {
   Formatter: formatter,
   onInit: function() {
    this.getRouter().getRoute("RoutePolicy").attachMatched(this.PL_onRouteMatched, this);
    this._employeeCache = null;
    this._employeePromise = null;
    this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
    // SAFE LOGIN MODEL CHECK
    var oLoginModel = this.getView().getModel("LoginModel");
    var sRole = "";
    if (oLoginModel) sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase();
    var bShowAdminControls = sRole === "admin" || sRole === "hr" || sRole === "hr manager";
    this.getView().setModel(new JSONModel({
     showAdminControls: bShowAdminControls
    }), "visibilityModel");
   },
   _getEmployeeDetails: async function() {
    if (this._employeeCache) {
     return this._employeeCache;
    }
    // If request already running → reuse same promise
    if (this._employeePromise) {
     return this._employeePromise;
    }
    const sEmpId = this.getView().getModel("LoginModel").getProperty("/EmployeeID");
    // store promise to prevent duplicate calls
    this._employeePromise = this.ajaxReadWithJQuery("EmployeeDetails", {
     EmployeeID: sEmpId
    }).then((oEmpResponse) => {
     if (oEmpResponse && oEmpResponse.success && oEmpResponse.data && oEmpResponse.data.length > 0) {
      const oEmployee = oEmpResponse.data[0];
      this._employeeCache = {
       department: (oEmployee.Department || "").toLowerCase().trim(),
       role: (oEmployee.Role || "").toLowerCase().trim()
      };
      this.getView().getModel("LoginModel").setProperty("/Department", this._employeeCache.department);
      this.getView().getModel("LoginModel").setProperty("/Role", this._employeeCache.role);
     }
     return this._employeeCache;
    });
    return this._employeePromise;
   },
   PL_loadRoleDepartment: async function() {
    const oView = this.getView();
    const oLoginModel = oView.getModel("LoginModel");
    // LOGIN EMPLOYEE
    const sEmpId = oLoginModel.getProperty("/EmployeeID");
    // API CALL
    const oResponse = await this.ajaxReadWithJQuery("Role_Department", {
     EmpID: sEmpId
    });
    let aData = [];
    // RESPONSE
    if (oResponse && oResponse.success) {
     aData = oResponse.data.map(function(item) {
      return {
       department: item.Department || "",
       designationName: item.Role || ""
      };
     });
    }
    // FULL MODEL
    this.getView().setModel(new JSONModel(aData), "DesignationModel");
    // UNIQUE DEPARTMENT
    const oDepartmentMap = {};
    const aDepartments = [];
    aData.forEach(function(oItem) {
     const sDepartment = (oItem.department || "").trim();
     if (sDepartment && !oDepartmentMap[sDepartment.toLowerCase()]) {
      oDepartmentMap[sDepartment.toLowerCase()] = true;
      aDepartments.push({
       department: sDepartment
      });
     }
    });
    // SET DEPARTMENT MODEL
    this.getView().setModel(new JSONModel(aDepartments), "DepartmentModel");
    // UNIQUE ROLES
    const oRoleMap = {};
    const aRoles = [];
    aData.forEach(function(oItem) {
     const sRole = (oItem.designationName || "").trim();
     const sDepartment = (oItem.department || "").trim();
     const sKey = sDepartment.toLowerCase() + "_" + sRole.toLowerCase();
     if (sRole && !oRoleMap[sKey]) {
      oRoleMap[sKey] = true;
      aRoles.push({
       department: sDepartment,
       designationName: sRole
      });
     }
    });
    // SET ROLE MODEL
    this.getView().setModel(new JSONModel(aRoles), "RoleModel");
    // DEFAULT FILTERED ROLE MODEL
    this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
   },
   // POLICY VISIBILITY FILTER
   PL_filterPoliciesByAccess: async function(aPolicies) {
    const oEmp = await this._getEmployeeDetails();
    var sLoginDepartment = oEmp?.department || "";
    var sLoginRole = oEmp?.role || "";
    const aAdminRoles = ["admin", "hr", "hr manager"];
    return aPolicies.filter(function(oPolicy) {
     var sPolicyDepartment = (oPolicy.department || "").toLowerCase().trim();
     var sPolicyRole = (oPolicy.role || "").toLowerCase().trim();
     if (aAdminRoles.includes(sLoginRole)) return true;
     if (sPolicyDepartment === "all" && sPolicyRole === "all") return true;
     if (sPolicyDepartment === sLoginDepartment && sPolicyRole === "all") return true;
     if (sPolicyDepartment === "all" && sPolicyRole === sLoginRole) return true;
     if (sPolicyDepartment === sLoginDepartment && sPolicyRole === sLoginRole) return true;
     return false;
    });
   },
   // ROUTE MATCHED
   PL_onRouteMatched: async function() {
    try {
     var LoginFunction = await this.commonLoginFunction("Policy");
     if (!LoginFunction) {
      return;
     }
     this.getBusyDialog();
     const oView = this.getView();
     const oLoginModel = oView.getModel("LoginModel");
     this.i18nModel = this.getOwnerComponent().getModel("i18n").getResourceBundle();
     oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("policyTitle"));
     await this.PL_loadRoleDepartment();
     this.byId("PL_id_SearchPolicy").setValue("");
     this.byId("PL_id_DepartmentFilter").setValue("");
     this.byId("PL_id_RoleFilter").setValue("");
     // IMPORTANT
     await this.PL_loadPolicies();
     this.getView().setModel(new JSONModel({
      EditBtn: true
     }), "VisibleModel");
     var sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase();
     var bShowAdminControls = sRole === "admin" || sRole === "hr" || sRole === "hr manager";
     this.getView().setModel(new JSONModel({
      showAdminControls: bShowAdminControls
     }), "visibilityModel");
     this.closeBusyDialog();
    } catch (oError) {
     this.closeBusyDialog();
     MessageBox.error("Failed to load policies");
    }
   },
   PL_applyFilter: function(sDepartment, sRole) {
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
   PL_loadPolicies: async function(aFilters = []) {
    try {
     const oResponse = await this.ajaxReadWithJQuery("Policy", aFilters && aFilters.length ? aFilters[0] : {});
     let aPolicies = [];
     if (oResponse && oResponse.success && oResponse.data) {
      aPolicies = oResponse.data.map(function(oItem, index) {
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
       let aActiveVersions = aItems.filter(function(v) {
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
        oLatest = aActiveVersions.reduce(function(max, item) {
         return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
        });
       }
       // No active version -> latest version
       else if (aItems.length > 0) {
        oLatest = aItems.reduce(function(max, item) {
         return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
        });
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
   _getActivePolicyVersion: function(aItems) {
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
   PL_onDepartmentChange: function(oEvent) {
    this.PL_onSelectionChangeValidation(oEvent);
    var oDepartmentCombo = oEvent.getSource();
    var sDepartment = (oDepartmentCombo.getSelectedKey() || "").trim();
    // ROLE CONTROLS
    var oRoleCreate = this.byId("PL_id_Role");
    var oRoleFilter = this.byId("PL_id_RoleFilter");
    var oRoleView = this.byId("PL_id_ViewRole");
    // CLEAR ROLE ALWAYS
    [oRoleCreate, oRoleFilter, oRoleView].forEach(function(oRole) {
     if (oRole) {
      oRole.setSelectedKey("");
      oRole.setValue("");
     }
    });
    // IF DEPARTMENT EMPTY
    // SHOW NO DATA IN ROLE
    if (!sDepartment) {
     this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
     return;
    }
    // GET ALL ROLES
    var aData = this.getView().getModel("DesignationModel").getData() || [];
    // FILTER ROLE
    var aFilteredRoles = aData.filter(function(oItem) {
     var sItemDepartment = (oItem.department || "").trim().toLowerCase();
     return (sItemDepartment === sDepartment.toLowerCase());
    });
    // REMOVE DUPLICATES
    var oUnique = {};
    var aUniqueRoles = [];
    aFilteredRoles.forEach(function(oItem) {
     var sRole = (oItem.designationName || "").trim();
     if (sRole && !oUnique[sRole]) {
      oUnique[sRole] = true;
      aUniqueRoles.push({
       designationName: sRole
      });
     }
    });
    // SET ROLE MODEL
    this.getView().setModel(new JSONModel(aUniqueRoles), "FilteredRoleModel");
   },
   PL_onFileUpload: function(oEvent) {
    const oFile = oEvent.getParameter("files")[0];
    if (!oFile) {
     return;
    }
    // BLOCK NON-PDF
    if (oFile.type !== "application/pdf") {
     MessageBox.error(this.i18nModel.getText("onlyPdfAllowed"));
     // CLEAR FILE NAME FROM UI
     oEvent.getSource().clear();
     // CLEAR MODEL DATA
     const oModel = this.getView().getModel("policyDialogModel");
     oModel.setProperty("/File_Content", "");
     oModel.setProperty("/File_Name", "");
     oModel.setProperty("/File_Type", "");
     return;
    }
    // READ FILE
    const oReader = new FileReader();
    oReader.onload = function(e) {
     const base64 = e.target.result.split(",")[1];
     const oModel = this.getView().getModel("policyDialogModel");
     oModel.setProperty("/File_Content", base64);
     oModel.setProperty("/File_Name", oFile.name);
     oModel.setProperty("/File_Type", oFile.type);
    }.bind(this);
    oReader.readAsDataURL(oFile);
   },
   _openVersionDialog: function(oData) {
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
   PL_onNewVersion: function(oEvent) {
    const oContext = oEvent.getSource().getBindingContext("policyModel");
    const oData = oContext.getObject();
    if (!this._oVersionDialog) {
     this._oVersionDialog = sap.ui.xmlfragment("sap.kt.com.minihrsolution.fragment.PolicyVersionDialog", this);
     this.getView().addDependent(this._oVersionDialog);
    }
    this.getView().setModel(new JSONModel({
     Parent_Policy_ID: oData.ID,
     PolicyName: oData.name,
     PolicyDesc: oData.desc,
     // NEXT VERSION BASED ON LATEST ACTIVE VERSION
     Version: this._getNextVersion(oData.currentVersion || "1.0"),
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
    this._FragmentDatePickersReadOnly(["PLV_id_StartDate"]);
   },
   _getNextVersion: function(sVersion) {
    if (!sVersion) {
     return "1.0";
    }
    const fVersion = parseFloat(sVersion);
    return (Math.round((fVersion + 0.1) * 10) / 10).toFixed(1);
   },
   PL_onVersionFileUpload: function(oEvent) {
    const oFile = oEvent.getParameter("files")[0];
    if (!oFile) return;
    const oReader = new FileReader();
    oReader.onload = function(e) {
     const base64 = e.target.result.split(",")[1];
     const oModel = this.getView().getModel("policyDialogModel");
     oModel.setProperty("/File_Content", base64);
     oModel.setProperty("/File_Name", oFile.name);
     oModel.setProperty("/File_Type", oFile.type);
    }.bind(this);
    oReader.readAsDataURL(oFile);
   },
   PL_onSaveNewVersion: async function() {
    const oModel = this.getView().getModel("policyDialogModel");
    const oData = oModel.getData();
    const sPolicyId = oData.Parent_Policy_ID;
    if (!sPolicyId) {
     MessageBox.error("Policy ID missing");
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
    // CLEAN BASE64
    let sFileContent = oData.File_Content || "";
    if (sFileContent.includes(",")) {
     sFileContent = sFileContent.split(",")[1];
    }
    // SAFETY CHECK 
    if (!sFileContent) {
     MessageBox.error("Please upload PDF file");
     return;
    }
    if (sFileContent.length > 5000000) {
     MessageBox.error("File too large. Please upload smaller PDF.");
     return;
    }
    // SAFE DATE FORMAT 
    const formatDate = function(d) {
     if (!d) return null;
     const dt = new Date(d);
     if (isNaN(dt.getTime())) return null;
     return dt.toISOString().split("T")[0];
    };
    const oPayload = {
     Policy_Parent_ID: sPolicyId,
     File_Name: oData.File_Name || "",
     File_Type: oData.File_Type || "application/pdf",
     File_Content: sFileContent,
     Start_Date: this._formatDateForDB(oData.Start_Date),
     Upload_Date: this._formatDateForDB(new Date()),
     End_Date: null,
     Version: oData.Version || "1.0"
    };
    try {
     this.getBusyDialog();
     const oResponse = await this.ajaxCreateWithJQuery("PolicyItems", {
      data: oPayload
     });
     MessageToast.show("New version created successfully");
     this._oVersionDialog.close();
     await this.PL_loadPolicies();
    } catch (e) {
     MessageBox.error("Version already exist. Please updtae your version");
    } finally {
     this.closeBusyDialog();
    }
   },
   PL_onViewVersion: async function(oEvent) {
    try {
     this.getBusyDialog();
     const oContext = oEvent.getSource().getBindingContext("policyModel");
     const oPolicy = oContext.getObject();
     const sPolicyId = oPolicy.ID;
     if (!sPolicyId) {
      MessageBox.error("Policy ID missing");
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
     MessageBox.error("Failed to load versions");
    } finally {
     this.closeBusyDialog();
    }
   },
   onCloseVersionHistory: function() {
    if (this._oVersionHistoryDialog) {
     this._oVersionHistoryDialog.close();
    }
   },
   onCloseVersionHistory: function() {
    if (this._oVersionHistoryDialog) {
     this._oVersionHistoryDialog.close();
    }
   },
   onDownloadVersionPdf: function(oEvent) {
    const oData = oEvent.getSource().getBindingContext("versionModel").getObject();
    if (!oData.File_Content) {
     MessageBox.error("No PDF found");
     return;
    }
    const sPdf = "data:application/pdf;base64," + oData.File_Content;
    const link = document.createElement("a");
    link.href = sPdf;
    link.download = oData.File_Name || "version.pdf";
    link.click();
   },
   PL_onCancelNewVersion: function() {
    // CLEAR FILE UPLOADER
    const oUploader = sap.ui.getCore().byId("PL_id_NewVersionFile");
    if (oUploader) {
     oUploader.clear();
    }
    if (this._oVersionDialog) {
     this._oVersionDialog.close();
    }
    this.getView().setModel(new JSONModel({}), "policyDialogModel");
   },
   // CREATE
   PL_onCreatePress: function() {
    const oDialogModel = new JSONModel({
     ID: "",
     title: "",
     description: "",
     department: "",
     role: "",
     Start_Date: "",
     // LOGO
     logoBase64: "",
     logoType: "",
     logo: "",
     // PDF
     File_Content: "",
     File_Name: "",
     File_Type: "",
     isEdit: false,
    });
    this.getView().setModel(oDialogModel, "policyDialogModel");
    this.PL_openDialog();
   },
   // OPEN DIALOG
   PL_openDialog: function() {
    if (this.FPL_oDialog) {
     this.FPL_oDialog.open();
     return;
    }
    if (this._bPolicyDialogLoading) {
     return;
    }
    this._bPolicyDialogLoading = true;
    Fragment.load({
     id: this.getView().getId(),
     name: "sap.kt.com.minihrsolution.fragment.PolicyDialog",
     controller: this
    }).then(function(oDialog) {
     this.FPL_oDialog = oDialog;
     this.getView().addDependent(oDialog);
     this._bPolicyDialogLoading = false;
     oDialog.open();
     this._FragmentDatePickersReadOnly([
      this.getView().createId("PL_id_StartDate"),
      this.getView().createId("PL_id_UploadDate")
     ]);
    }.bind(this)).catch(function(oError) {
     this._bPolicyDialogLoading = false;
    }.bind(this));
   },
   // live validation
   // REMOVE ERROR FOR INPUT
   PL_onLiveChangeValidation: function(oEvent) {
    var oField = oEvent.getSource();
    var sValue = oField.getValue().trim();
    if (sValue) {
     oField.setValueState("None");
     oField.setValueStateText("");
    }
   },
   // REMOVE ERROR FOR SELECT
   PL_onSelectionChangeValidation: function(oEvent) {
    var oField = oEvent.getSource();
    var sKey = oField.getSelectedKey();
    if (sKey) {
     oField.setValueState("None");
     oField.setValueStateText("");
    }
   },
   // REMOVE ERROR FOR DATE
   PL_onDateValidation: function(oEvent) {
    var oField = oEvent.getSource();
    var sValue = oField.getValue().trim();
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
   PL_onSavePolicy: async function() {
    try {
     // TITLE VALIDATION
     if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_Title"), "ID", )) {
      this.byId("PL_id_Title").setValueState("Error");
      this.byId("PL_id_Title").setValueStateText("Policy title is required");
      return;
     }
     // DESCRIPTION VALIDATION
     if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_Description"), "ID", )) {
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
      MessageBox.error("Please upload PDF");
      return;
     }
     // START DATE VALIDATION
     if (!Validation._LCvalidateDate(this.byId("PL_id_StartDate"), "ID")) {
      this.byId("PL_id_StartDate").setValueState("Error");
      this.byId("PL_id_StartDate").setValueStateText("Please enter a valid start date");
      return;
     }
     //Create DATE VALIDATION
     if (!Validation._LCvalidateDate(this.byId("PL_id_UploadDate"), "ID")) {
      this.byId("PL_id_UploadDate").setValueState("Error");
      this.byId("PL_id_UploadDate").setValueStateText("Please enter a valid date");
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
      File_Content: oData.File_Content,
      File_Name: oData.File_Name,
      File_Type: oData.File_Type,
      Logo: oData.logoBase64 || "",
     };
     // BUSY DIALOG
     this.getBusyDialog();
     // CLEAR FILE UPLOADERS
     var aUploaders = this.getView().findAggregatedObjects(true, function(oControl) {
      return oControl.isA("sap.ui.unified.FileUploader");
     }, );
     aUploaders.forEach(function(oUploader) {
      oUploader.clear();
     });
     // UPDATE
     if (oData.isEdit) {
      const oUpdatePayload = {
       filters: {
        ID: oData.ID,
       },
       data: oPayloadData,
      };
      await this.ajaxUpdateWithJQuery("Policy", oUpdatePayload);
     } else {
      // CREATE
      await this.ajaxCreateWithJQuery("Policy", {
       data: oPayloadData,
      });
     }
     // SUCCESS MESSAGE
     // SUCCESS MESSAGE
     MessageToast.show("Policy created successfully");
     // CLOSE DIALOG
     if (this.FPL_oDialog) {
      this.FPL_oDialog.close();
     }
     // GET CURRENT FILTER VALUES
     const sSearch = this.byId("PL_id_SearchPolicy")?.getValue()?.trim() || "";
     const sDepartment = this.byId("PL_id_DepartmentFilter")?.getSelectedKey()?.trim() || "";
     const sRole = this.byId("PL_id_RoleFilter")?.getSelectedKey()?.trim() || "";
     try {
      // KEEP CURRENT FILTERS
      if (sSearch || sDepartment || sRole) {
       await this.PL_onSearchPolicy();
      } else {
       await this.PL_loadPolicies();
      }
      const oPolicyModel = this.getView().getModel("policyModel");
      if (oPolicyModel) {
       oPolicyModel.refresh(true);
      }
     } catch (oRefreshError) {}
     // CLOSE BUSY
     this.closeBusyDialog();
    } catch (oError) {
     this.closeBusyDialog();
     MessageBox.error(oError.message || "Save failed");
    }
   },
   // CANCEL
   PL_onCancelPolicy: function() {
    // RESET MODEL
    this.getView().setModel(new JSONModel({
     ID: "",
     title: "",
     description: "",
     department: "",
     role: "",
     // LOGO
     logoBase64: "",
     logoType: "",
     logo: "",
     // PDF
     File_Content: "",
     File_Name: "",
     File_Type: "",
     isEdit: false,
    }), "policyDialogModel", );
    this.byId("PL_id_Title").setValueState("None");
    this.byId("PL_id_Description").setValueState("None");
    this.byId("PL_id_Department").setValueState("None");
    this.byId("PL_id_Role").setValueState("None");
    // CLEAR FILE UPLOADERS
    var aUploaders = this.getView().findAggregatedObjects(true, function(oControl) {
     return oControl.isA("sap.ui.unified.FileUploader");
    }, );
    aUploaders.forEach(function(oUploader) {
     oUploader.clear();
    });
    // CLOSE DIALOG
    if (this.FPL_oDialog) {
     this.FPL_oDialog.close();
    }
   },
   // LOGO UPLOAD
   PL_onLogoUpload: function(oEvent) {
    const oFile = oEvent.getParameter("files")[0];
    if (!oFile) return;
    if (!oFile.type.startsWith("image/")) {
     MessageBox.error("Only images allowed");
     return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
     const base64 = e.target.result.split(",")[1];
     const oModel = this.getView().getModel("policyDialogModel");
     oModel.setProperty("/logoBase64", base64);
     oModel.setProperty("/logoType", oFile.type);
     // oModel.setProperty("/fileName", oFile.name);
    }.bind(this);
    reader.readAsDataURL(oFile);
   },
   // LOGO TYPE VALIDATION
   PL_onLogoTypeMissmatch: function() {
    MessageBox.error(this.i18nModel.getText("onlyImagesAllowed"));
   },
   // LOGO SIZE EXCEED
   PL_onLogoSizeExceed: function() {
    MessageBox.error(this.i18nModel.getText("logoSizeExceeded"));
   },
   PL_onViewPolicy: async function(oEvent) {
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
     console.log(JSON.stringify(oResponse, null, 2));
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
     console.log("Policy ID:", oObject.ID);
     console.log("Selected Version:", oSelectedVersion);
     console.log("File_Content:", oSelectedVersion?.File_Content);
     console.log("All Items:", aItems);
     if (!sBase64) {
      this.closeBusyDialog();
      MessageBox.error("PDF Base64 is empty");
      return;
     }
     sBase64 = String(sBase64).replace(/^data:.*;base64,/, "").replace(/\s/g, "");
     if (!sBase64.startsWith("JVBER")) {
      this.closeBusyDialog();
      MessageBox.error("Invalid PDF file");
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
      acknowledged: false,
      employeeIds: sAckIds,
      alreadyAcknowledged: bAlreadyAcknowledged
     });
     this.getView().setModel(oViewModel, "policyViewModel");
     this.closeBusyDialog();
     this.PL_openViewDialog();
    } catch (e) {
     this.closeBusyDialog();
     MessageBox.error("Failed to load PDF");
    }
   },
   onAcknowledgeCheck: function(oEvent) {
    const bSelected = oEvent.getParameter("selected");
    this.getView().getModel("policyViewModel").setProperty("/acknowledged", bSelected);
   },
   onPressAcknowledge: function() {
    const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
    const oViewModel = this.getView().getModel("policyViewModel");
    // EXISTING IDS
    let sExistingIds = oViewModel.getProperty("/employeeIds") || "";
    let aIds = sExistingIds ? sExistingIds.split(",") : [];
    aIds = aIds.map(function(id) {
     return id.trim();
    }).filter(Boolean);
    // ADD EMPLOYEE ONLY ONCE
    if (!aIds.includes(sEmployeeId)) {
     aIds.push(sEmployeeId);
    }
    const sFinalIds = aIds.join(",");
    MessageBox.confirm("Are you sure you want to acknowledge this policy?", {
     title: "Confirmation",
     actions: [
      MessageBox.Action.YES,
      MessageBox.Action.NO
     ],
     emphasizedAction: MessageBox.Action.YES,
     onClose: function(sAction) {
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
      }).then(async function() {
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
       MessageToast.show("Policy acknowledged successfully");
       if (this.FPL_oViewDialog) {
        this.FPL_oViewDialog.close();
       }
      }.bind(this)).catch(function(oError) {
       this.closeBusyDialog();
       MessageBox.error("Failed to acknowledge policy. Please try again.");
      }.bind(this));
     }.bind(this)
    });
   },
   _createPdfIframe: function() {
    const sPdfUrl = this.getView().getModel("policyViewModel").getProperty("/fileUrl");
    const oHtml = this.byId("pdfFrame");
    const sIframe = "<iframe " + "src='" + sPdfUrl + "#toolbar=0&navpanes=0&scrollbar=0' " + "width='100%' " + "height='100%' " + "style='" + "border:none;" + "width:100%;" + "height:100vh;" + "display:block;" + "' " + "allowfullscreen>" + "</iframe>";
    oHtml.setContent(sIframe);
   },
   PL_openViewDialog: function() {
    this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
    this.getBusyDialog();
    const fnLoadPdf = function() {
     setTimeout(function() {
      this._createPdfIframe();
     }.bind(this), 0);
    }.bind(this);
    const fnRefreshPolicyData = async function() {
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
     } catch (e) {}
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
    }).then(function(oDialog) {
     this.FPL_oViewDialog = oDialog;
     this.getView().addDependent(oDialog);
     oDialog.open();
     Promise.all([
      fnRefreshPolicyData(),
      fnLoadPdf(),
     ]).finally(() => {
      this.closeBusyDialog();
     });
    }.bind(this));
   },
   _getActivePolicyItem: function(aItems) {
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
     if (dStart) dStart.setHours(0, 0, 0, 0);
     if (dEnd) dEnd.setHours(0, 0, 0, 0);
     return (dStart && dStart <= today && (!dEnd || today <= dEnd));
    });
    // STEP 2: fallback if no active → use all
    const finalList = activeItems.length > 0 ? activeItems : aItems;
    // STEP 3: pick HIGHEST VERSION
    finalList.sort((a, b) => {
     const v1 = parseFloat(a.Version || "0");
     const v2 = parseFloat(b.Version || "0");
     return v2 - v1; // descending
    });
    return finalList[0];
   },
   // go button 
   PL_onSearchPolicy: async function() {
    try {
     this.getBusyDialog();
     const sSearch = this.byId("PL_id_SearchPolicy").getValue().trim();
     const sDepartment = this.byId("PL_id_DepartmentFilter").getValue().trim();
     const sRole = this.byId("PL_id_RoleFilter").getValue().trim();
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
         const sBase64 = new TextDecoder().decode(new Uint8Array(oItem.Logo.data));
         sImageUrl = "data:image/png;base64," + sBase64;
        }
       }
    
       const oActiveItem = this._getActivePolicyItem(oItem.Items || []);
       return {
        ID: oItem.ID,
        name: oItem.PolicyName,
        desc: oItem.PolicyDesc,
        UploadDate: oItem.UploadDate ? new Date(oItem.UploadDate).toLocaleDateString("en-GB") : "",
        Start_Date: oItem.Start_Date ? new Date(oItem.Start_Date).toLocaleDateString("en-GB") : "",
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
     MessageBox.error("Failed to load policies");
    } finally {
     this.closeBusyDialog();
    }
   },
   PL_onClearPolicy: function() {
    // SEARCH
    this.byId("PL_id_SearchPolicy").setValue("");
    // DEPARTMENT
    this.byId("PL_id_DepartmentFilter").setSelectedKey("");
    // ROLE
    this.byId("PL_id_RoleFilter").setSelectedKey("");
   },
   PL_onLiveSearchPolicy: function(oEvent) {
    var sValue = oEvent.getParameter("newValue").toLowerCase();
    var oModel = this.getView().getModel("policyModel");
    // Store original data once
    if (!this._aAllPolicies) {
     this._aAllPolicies = oModel.getProperty("/policies");
    }
    var aFilteredPolicies;
    // If search empty -> restore all data
    if (!sValue) {
     aFilteredPolicies = this._aAllPolicies;
    } else {
     aFilteredPolicies = this._aAllPolicies.filter(function(oPolicy) {
      return (oPolicy.name && oPolicy.name.toLowerCase().includes(sValue));
     });
    }
    oModel.setProperty("/policies", aFilteredPolicies);
   },
   PL_onPressEditAndSave: function(oEvent) {
    debugger;
    if (oEvent.getSource().getText() === "Edit") {
     this.onPressEdit();
    } else {
     this.onPressSave();
    }
   },
   _updateRoleModel: function(sDepartment) {
    var aData = this.getView().getModel("DesignationModel").getData() || [];
    var aFilteredRoles = aData.filter(function(oItem) {
     return (oItem.department || "").trim().toLowerCase() === sDepartment.toLowerCase();
    });
    var oUnique = {};
    var aUniqueRoles = [];
    aFilteredRoles.forEach(function(oItem) {
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
   onPressEdit: function() {
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
   },
   onPressSave: async function() {
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
     // CLOSE DIALOG
     if (this.FPL_oViewDialog) {
      this.FPL_oViewDialog.close();
     }
     // BUSY CLOSE
     this.closeBusyDialog();
     // SUCCESS MESSAGE
     MessageToast.show("Policy updated successfully");
    } catch (oError) {
     this.closeBusyDialog();
     MessageBox.error("Update failed");
    }
   },
   // FORMAT DATE FOR DB
   _formatDateForDB: function(sDate) {
    if (!sDate) return null;
    const d = new Date(sDate);
    if (isNaN(d.getTime())) {
     return null;
    }
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
   },
   onPressback: function() {
    this.getRouter().navTo("RouteTilePage");
   },
   onLogout: function() {
    this.CommonLogoutFunction();
   },
   // view dialog close
   PL_onCloseViewDialog: function() {
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
  }, );
 }, );
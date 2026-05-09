sap.ui.define([
  "sap/ui/integration/Extension",
  "sap/m/MessageToast"
], function (Extension, MessageToast) {
  "use strict";
  return Extension.extend("sap.kt.com.minihrsolution.cards.Extension", {
    init: function () {
      Extension.prototype.init.apply(this, arguments);
      this.attachAction(this._handleAction.bind(this));
    },
    
    _fetchGoals: function () {
      var that = this;
       var currentYear = new Date().getFullYear();
      return fetch("https://rest.kalpavrikshatechnologies.com/Goals", {
        method: "GET",
        headers: {
          "name": "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
          "password": "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"
        }
      })
       .then(res => res.json())
  .then(res => {

    var filtered = (res.data || []).filter(g => {
      return new Date(g.StartDate).getFullYear() === currentYear;
    });

    that._data = filtered;
    return filtered;
  });
},

getQuestionsWithActions: function () {

  var goalId = this.getCard().getParameters().GoalId;
  var params = this.getCard().getParameters();
  var currentYear = new Date().getFullYear();

  // HANDLE EMPTY CARD 
  
  if (!goalId) {
    return Promise.resolve({
      GoalId: "",
      Question: "",
      Description: params.Description || "You don't have goals yet",
      Topic: params.Topic || "No Goal Created",
      Quarter: params.Quarter || "",

      EmpId: "",
      EmpName: "",
      StartDate: "",
      EndDate: "",
      Status: "",

      ScoresRemark: "",
      Score: "",
      HelpRequired: "",
      CreatedDate: "",

      editable1: false,
      editable2: true,
      isCurrentYear: true
    });
  }

  // 2. ONLY IF REAL DATA â†’ CALL BACKEND
  return this._fetchGoals().then(function (data) {

    var item = data.find(x => String(x.GoalId) === String(goalId)) || {};

    var goalYear = item.StartDate
      ? new Date(item.StartDate).getFullYear()
      : null;

    return {
      GoalId: item.GoalId,
      Question: item.Question,
      Description: item.Description,
      Topic: item.Topic,
      Quarter: item.Quarter,

      EmpId: item.EmpId,
      EmpName: item.EmpName,
      StartDate: item.StartDate,
      EndDate: item.EndDate,
      Status: item.Status,

      ScoresRemark: item.ScoresRemark,
      Score: item.Score,
      HelpRequired: item.HelpRequired,
      CreatedDate: item.CreatedDate,

      editable1: false,
      editable2: true,
      isCurrentYear: goalYear === currentYear
    };
  });
},

    _handleAction: function (oEvent) {

      var params = oEvent.getParameter("parameters") || {};
      var method = params.method;
      var id = params.id;

      var card = this.getCard();
      var model = card.getModel();
      var data = model.getData();

      // ================= EDIT =================
      if (method === "edit") {

        data.editable1 = true;   // show TextArea
        data.editable2 = false;  // hide Text

        model.refresh();

        MessageToast.show("Edit mode ON");
        return;
      }
if (method === "save") {

  var oCard = this.getCard();
  var oTextArea = oCard.getDomRef().querySelector("textarea");

  var updatedDescription = oTextArea ? oTextArea.value : data.Description;

var payload = {
    filters: {
      GoalId: data.GoalId   
    },
    data: {
      EmpID: data.EmpId,            
      EmpName: data.EmpName,
      Topic: data.Topic,
      Quarter: data.Quarter,
      StartDate: data.StartDate,
      EndDate: data.EndDate,

     
      Description: updatedDescription,

      Status: data.Status,

      // include ALL required backend fields
      ScoresRemark: data.ScoresRemark || "",
      Score: data.Score || "0",
      HelpRequired: data.HelpRequired || "",
      CreatedDate: data.CreatedDate || data.StartDate
    }
  };

  console.log("FINAL PAYLOAD:", payload); // DEBUG

  $.ajax({
    url: "https://rest.kalpavrikshatechnologies.com/Goals",
    method: "PUT",
    data: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      "name": "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
      "password": "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"
    },
    success: () => {

      // update UI instantly
      data.Description = updatedDescription;

      data.editable1 = false;
      data.editable2 = true;

      this.getCard().getModel().refresh();

      MessageToast.show("Saved Successfully");
    },
    error: (err) => {
      console.error("FULL ERROR:", err);
      console.error("RESPONSE TEXT:", err.responseText);
      MessageToast.show("Save Failed");
    }
  });

  return;
}
      // ================= CANCEL =================
      if (method === "cancel") {
        data.editable1 = false;
        data.editable2 = true;
        model.refresh();
        MessageToast.show("Cancelled");
      }
    }
  });
});
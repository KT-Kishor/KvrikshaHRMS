sap.ui.define(["../fonts/Montserrat"], function (Montserrat) {
    "use strict";

    function _toImgSrc(sValue, sFallbackMime) {
        if (!sValue) {
            return null;
        }
        if (typeof sValue === "string") {
            return sValue.indexOf("data:") === 0 ? sValue : "data:" + (sFallbackMime || "image/png") + ";base64," + sValue;
        }
        return null;
    }

    function _formatCompanyName(sValue) {
        if (!sValue) {
            return "";
        }
        return String(sValue).replace(/\s+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
    }

    function _ensureMontserratFontFace() {
        if (document.getElementById("montserratFontFace")) {
            return;
        }
        var oStyle = document.createElement("style");
        oStyle.id = "montserratFontFace";
        oStyle.textContent = "@font-face{font-family:'Montserrat';font-weight:normal;font-style:normal;" + "src:url(data:font/truetype;base64," + Montserrat.regular.base64 + ") format('truetype');}" + "@font-face{font-family:'Montserrat';font-weight:bold;font-style:normal;" + "src:url(data:font/truetype;base64," + Montserrat.bold.base64 + ") format('truetype');}";
        document.head.appendChild(oStyle);
    }

    function _registerMontserratFont(oPdf) {
        oPdf.addFileToVFS(Montserrat.regular.filename, Montserrat.regular.base64);
        oPdf.addFont(Montserrat.regular.filename, Montserrat.name, Montserrat.regular.style);
        oPdf.addFileToVFS(Montserrat.bold.filename, Montserrat.bold.base64);
        oPdf.addFont(Montserrat.bold.filename, Montserrat.name, Montserrat.bold.style);
    }
    // Draws the company logo as a translucent circular watermark on the current page
    function _drawCircularWatermark(oPdf, sImgSrc, nPageWidth, nPageHeight, nWidthMm, nHeightMm, nOpacity) {
        if (!sImgSrc) {
            return;
        }
        try {
            oPdf.saveGraphicsState();
            oPdf.setGState(new oPdf.GState({
                opacity: nOpacity
            }));
            oPdf.addImage(sImgSrc, "PNG", (nPageWidth - nWidthMm) / 2, (nPageHeight - nHeightMm) / 2, nWidthMm, nHeightMm);
            oPdf.restoreGraphicsState();
        } catch (e) {
            console.error("Watermark render failed:", e);
        }
    }
// Ensures any tables pasted into the rich-text content (e.g. from Word/Markdown)
// actually show borders in the exported PDF. Rich-text editors usually render
// table borders via their own internal stylesheet, which does NOT travel with
// the raw HTML — so without this, html2canvas captures a borderless table.
function _applyTableBorders(oContainer) {
    var aTables = oContainer.querySelectorAll("table");
    aTables.forEach(function (oTable) {
        oTable.style.borderCollapse = "collapse";
        oTable.style.width = oTable.style.width || "100%";
        oTable.style.border = "1px solid #333";

        var aCells = oTable.querySelectorAll("th, td");
        aCells.forEach(function (oCell) {
            oCell.style.border = "1px solid #333";
            oCell.style.padding = "6px 8px";
            oCell.style.fontSize = oCell.style.fontSize || "14px";
        });
    });
}
    function _sliceCanvas(oSourceCanvas, nSrcYPx, nSrcHeightPx) {
        var oSlice = document.createElement("canvas");
        oSlice.width = oSourceCanvas.width;
        oSlice.height = Math.max(1, Math.round(nSrcHeightPx));
        oSlice.getContext("2d").drawImage(oSourceCanvas, 0, nSrcYPx, oSourceCanvas.width, nSrcHeightPx, 0, 0, oSlice.width, oSlice.height);
        return oSlice;
    }
    return {
        generatePDF: function (mData, mCompanyInfo) {
            mCompanyInfo = mCompanyInfo || {};
            return new Promise(function (resolve, reject) {
                try {
                    if (!window.html2canvas || !window.jspdf) {
                        reject(new Error("PDF libraries (html2canvas / jsPDF) are not loaded. Check index.html."));
                        return;
                    }
                    var jsPDF = window.jspdf.jsPDF;
                    var sCompanyName = _formatCompanyName(mCompanyInfo.companyName);
                    var sCompanyAddress = mCompanyInfo.address || "";
                    var sCompanyColor = mCompanyInfo.colorCode || "#1976D2";
                    var sFontFamily = mCompanyInfo.fontFamily || "Montserrat";
                    var sTitleFontSize = mCompanyInfo.titleFontSize || "32px";
                    var sAddressFontSize = mCompanyInfo.addressFontSize || "18px";
                    var sTitleMarginTop = mCompanyInfo.titleMarginTop || "18px";
                    var sAddressMarginTop = mCompanyInfo.addressMarginTop || "4px";
                    var sLogoSrc = _toImgSrc(mCompanyInfo.logo);
                    var sSignatureSrc = _toImgSrc(mCompanyInfo.signature);
                    var sBackgroundLogoSrc = _toImgSrc(mCompanyInfo.backgroundLogo) || sLogoSrc;
                    var nSidePaddingPx = Math.round(0.5 * 96);
                    var oContainer = document.createElement("div");
                    oContainer.id = "pdfPrintArea";
                    oContainer.style.width = "794px";
                    oContainer.style.position = "absolute";
                    oContainer.style.left = "-9999px";
                    oContainer.style.top = "0";
                    oContainer.style.fontFamily = sFontFamily;
                    oContainer.style.boxSizing = "border-box";
                    var sLogoHtml = sLogoSrc ? '<img src="' + sLogoSrc + '" style="width:125px; height:125px; object-fit:contain; border:none; outline:none; box-shadow:none; background:transparent; display:block;" />' : '';
                    var sSubjectValue = mData.subject || "";
                    var sToValue = mData.to || "";

                    var sToSubjectRowHtml = "";

                    if (sToValue) {

                        sToSubjectRowHtml =
                            '<div style="font-size:18px; margin-bottom:15px; max-width:55%;">'
                            + 'To: ' + sToValue +
                            '</div>' +

                            '<div style="text-align:center; font-size:18px; text-transform:uppercase; margin-top:28px">' +
                            sSubjectValue +
                            '</div>';

                    } else {

                        sToSubjectRowHtml =
                            '<div style="text-align:center; font-size:18px; text-transform:uppercase; margin-bottom:22px;">' +
                            sSubjectValue +
                            '</div>';
                    }
                    oContainer.innerHTML = '<div style="width:100%; position:relative;">' + '<div style="position:relative; z-index:1; padding:35px ' + nSidePaddingPx + 'px;">' + '<div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:4px;">' + sLogoHtml + '<div><div style="font-family:' + sFontFamily + '; font-size:' + sTitleFontSize + '; font-weight:bold; transform:scaleY(1.5); text-transform:uppercase; margin-top:' + sTitleMarginTop + '; text-align:center; color:' + sCompanyColor + ';">' + sCompanyName + '</div>' + '<div style="font-family:' + sFontFamily + '; font-size:' + sAddressFontSize + '; line-height:1.5; margin-top:' + sAddressMarginTop + '; color:#333; text-align:center; width:500px; word-wrap:break-word; white-space:normal;">' + sCompanyAddress + '</div></div></div>' + '<div style="border-top:1.5px solid #333; margin: 5px 0 20px 0;"></div>' + '<div style="display:flex; justify-content:space-between; margin-bottom:22px; font-size:18px;">' + '<div>Ref No: ' + (mData.referenceNumber || "-") + '</div><div>Date: ' + (mData.date || "-") + '</div></div>' + '<div style="margin-top:34px;"></div>' + '<div style="margin-top:34px;"></div>' + sToSubjectRowHtml + '<div style="font-size:18px; line-height:1.6; text-align:justify; margin-bottom:70px;">' + (mData.content || "") + '</div>' + '</div></div>';
                    _ensureMontserratFontFace();
                    _applyTableBorders(oContainer);
                    document.body.appendChild(oContainer);
                    var aImages = oContainer.querySelectorAll("img");
                    var iPending = aImages.length;
                    var fWaitForFonts = function () {
                        if (!document.fonts || !document.fonts.load) {
                            return Promise.resolve();
                        }
                        return Promise.all([
                            document.fonts.load("normal 16px Montserrat"),
                            document.fonts.load("bold 32px Montserrat")
                        ]).then(function () {
                            return document.fonts.ready;
                        }).catch(function () {
                            return null;
                        });
                    };
                    var fRender = function () {
                        window.html2canvas(oContainer, {
                            scale: 2,
                            useCORS: true,
                            allowTaint: true,
                            backgroundColor: null,
                            windowWidth: oContainer.scrollWidth,
                            windowHeight: oContainer.scrollHeight,
                            height: oContainer.scrollHeight,
                            width: oContainer.scrollWidth
                        }).then(function (canvas) {
                            document.body.removeChild(oContainer);
                            var oPdf = new jsPDF("p", "mm", "a4");
                            _registerMontserratFont(oPdf);
                            var nPageWidth = oPdf.internal.pageSize.getWidth();
                            var nPageHeight = oPdf.internal.pageSize.getHeight();
                            var nMarginMm = 15.05;
                            var nImgWidthMm = nPageWidth - (2 * nMarginMm);
                            var nPxPerMm = canvas.width / nImgWidthMm;
                            var nTotalHeightMm = canvas.height / nPxPerMm;
                            var nAvailableWidthMm = nPageWidth - (2 * nMarginMm);
                            var nAvailableHeightMm = nPageHeight - (2 * nMarginMm);
                            var nWatermarkWidth = 120;
                            var nWatermarkHeight = 120;
                            var nWatermarkOpacity = 0.15;
                            var nConsumedMm = 0;
                            var nRemainingMm = nTotalHeightMm;
                            var bFirstPage = true;
                            var nLastSliceHeightMm = 0;
                            while (nRemainingMm > 0.01) {
                                if (!bFirstPage) {
                                    oPdf.addPage();
                                }
                                _drawCircularWatermark(oPdf, sBackgroundLogoSrc, nPageWidth, nPageHeight, nWatermarkWidth, nWatermarkHeight, nWatermarkOpacity);
                                nLastSliceHeightMm = Math.min(nAvailableHeightMm, nRemainingMm);
                                var nSrcYPx = nConsumedMm * nPxPerMm;
                                var nSrcHeightPx = Math.min(nLastSliceHeightMm * nPxPerMm, canvas.height - nSrcYPx);
                                var oSliceCanvas = _sliceCanvas(canvas, nSrcYPx, nSrcHeightPx);
                                oPdf.addImage(oSliceCanvas.toDataURL("image/png"), "PNG", nMarginMm, nMarginMm, nAvailableWidthMm, nLastSliceHeightMm);
                                nConsumedMm += nLastSliceHeightMm;
                                nRemainingMm -= nLastSliceHeightMm;
                                bFirstPage = false;
                            }
                            // Footer: For / Signature / Director - anchored on the last content page
                            oPdf.setPage(oPdf.getNumberOfPages());
                            var nCanvasScale = 2;
                            var nFooterLeft = nMarginMm + (nSidePaddingPx * nCanvasScale) / nPxPerMm;
                            var nFooterHeight = 30;
                            var nFooterY = nMarginMm + nLastSliceHeightMm - 10;
                            if (nFooterY + nFooterHeight > (nPageHeight - nMarginMm)) {
                                oPdf.addPage();
                                _drawCircularWatermark(oPdf, sBackgroundLogoSrc, nPageWidth, nPageHeight, nWatermarkWidth, nWatermarkHeight, nWatermarkOpacity);
                                nFooterY = nMarginMm;
                            }
                            oPdf.setFont("Montserrat", "normal");
                            oPdf.setFontSize(13);
                            oPdf.text("For: " + sCompanyName, nFooterLeft, nFooterY);
                            if (mData.includeSignature && sSignatureSrc) {
                                oPdf.addImage(sSignatureSrc, "PNG", nFooterLeft, nFooterY + 4, 35, 15);
                            }
                            oPdf.setFont("Montserrat", "normal");
                            oPdf.setFontSize(13);
                            oPdf.text("Director", nFooterLeft, nFooterY + 24);
                            oPdf.save((mData.fileName || "Letterhead") + ".pdf");
                            resolve(oPdf);
                        }).catch(function (oError) {
                            if (document.body.contains(oContainer)) {
                                document.body.removeChild(oContainer);
                            }
                            reject(oError);
                        });
                    };
                    var fRenderAfterFonts = function () {
                        fWaitForFonts().then(fRender);
                    };
                    if (iPending === 0) {
                        setTimeout(fRenderAfterFonts, 100);
                        return;
                    }
                    var fCheckDone = function () {
                        iPending -= 1;
                        if (iPending <= 0) {
                            setTimeout(fRenderAfterFonts, 100);
                        }
                    };
                    aImages.forEach(function (oImg) {
                        if (oImg.complete) {
                            fCheckDone();
                        } else {
                            oImg.onload = fCheckDone;
                            oImg.onerror = fCheckDone;
                        }
                    });
                } catch (oError) {
                    reject(oError);
                }
            });
        }
    };
});
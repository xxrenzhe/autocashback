// ========== ✅ 配置项 ========== 
var txtFileName = "cameo-0513.txt"; // Drive文件名（包含链接）
var deleteUsedLink = true;         // 是否从文件中删除已用链接（true: 删除, false: 保留）
// =================================

function main() {
  Logger.log("🕒 脚本开始执行: " + new Date());

  var urls = getUrlsFromDriveFile(txtFileName);
  if (urls.length === 0) {
    Logger.log("❌ 未获取到任何链接，终止脚本");
    return;
  }

  // 获取所有广告系列名称
  var campaignNames = getCampaignNames();

  // 如果链接数不足，提示警告
  if (urls.length < campaignNames.length) {
    Logger.log("⚠️ 链接数量不足以更新所有广告系列！");
    return;
  }

  // 批量更新广告系列
  var updatedCount = 0;
  var updatedSitelinks = new Set(); // 用于记录已更新的附加链接
  campaignNames.forEach(function(name, index) {
    try {
      var campaignIterator = AdsApp.campaigns()
        .withCondition("CampaignName = '" + name + "'")
        .get();

      if (campaignIterator.hasNext()) {
        var campaign = campaignIterator.next();
        var urlsObj = campaign.urls();
        var currentSuffix = urlsObj.getFinalUrlSuffix();

        // 获取对应广告系列的链接
        var selectedUrl = urls[index];
        var { finalUrl, finalUrlSuffix } = extractUrlParts(selectedUrl);

        // 更新广告系列的 Final URL Suffix
        if (!finalUrlSuffix) {
          Logger.log("❌ 无法提取链接参数，跳过处理: " + selectedUrl);
          return;
        }
        Logger.log("🔧 更新 [" + name + "] 的 Final URL Suffix: " + finalUrlSuffix);

        if (currentSuffix !== finalUrlSuffix) {
          urlsObj.setFinalUrlSuffix(finalUrlSuffix);
          Logger.log("✅ 已更新 [" + name + "] 的 Final URL Suffix 为: " + finalUrlSuffix);
          updatedCount++;
        } else {
          Logger.log("ℹ️ [" + name + "] Suffix 已是最新，跳过");
        }

        // 更新附加链接的 Final URL 和 Final URL Suffix
        var sitelinks = campaign.extensions().sitelinks().get();
        while (sitelinks.hasNext()) {
          var sitelink = sitelinks.next();
          var sitelinkUrls = sitelink.urls();
          var currentSitelinkSuffix = sitelinkUrls.getFinalUrlSuffix();

          // 只修改尚未更新的附加链接
          if (!updatedSitelinks.has(sitelink.getId()) && currentSitelinkSuffix !== finalUrlSuffix) {
            sitelinkUrls.setFinalUrlSuffix(finalUrlSuffix);
            Logger.log("✅ 已更新附加链接的 Final URL Suffix: " + finalUrlSuffix);
            updatedCount++;
            updatedSitelinks.add(sitelink.getId()); // 记录已更新的附加链接
          } else {
            Logger.log("ℹ️ 附加链接的 Suffix 已是最新，跳过");
          }
        }

      } else {
        Logger.log("❌ 未找到广告系列: " + name);
      }
    } catch (e) {
      Logger.log("❌ 更新广告系列 [" + name + "] 出错: " + e.toString());
    }
  });

  // 是否需要从文件中删除已用链接
  if (deleteUsedLink) {
    urls.splice(0, campaignNames.length); // 删除已用链接
    updateDriveFile(txtFileName, urls); // 写回文件
    Logger.log("🗑️ 已从文件中删除已使用链接");
  } else {
    Logger.log("📌 设置为不删除链接，保留原文件内容");
  }

  Logger.log("🎉 更新完成，共更新 " + updatedCount + " 个广告系列及附加链接");
  Logger.log("✅ 脚本结束");
}

// ========== ✅ 辅助函数 ==========

// 读取 Drive 文件内容并返回链接数组
function getUrlsFromDriveFile(filename) {
  try {
    var files = DriveApp.getFilesByName(filename);
    if (!files.hasNext()) {
      Logger.log("❌ Google Drive 中未找到文件: " + filename);
      return [];
    }
    var file = files.next();
    var content = file.getBlob().getDataAsString('UTF-8');
    var lines = content.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    Logger.log("📄 读取链接数: " + lines.length);
    return lines;
  } catch (e) {
    Logger.log("❌ 读取文件出错: " + e.toString());
    return [];
  }
}

// 获取 Google Ads 中所有广告系列名称
function getCampaignNames() {
  var campaignNames = [];
  var campaignIterator = AdsApp.campaigns().get();
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    campaignNames.push(campaign.getName());
  }
  Logger.log("📋 获取到 " + campaignNames.length + " 个广告系列名称");
  return campaignNames;
}

// 提取 URL 的 Final URL 和 Final URL Suffix
function extractUrlParts(url) {
  var match = url.match(/^(.*?)\?(.*)$/);
  return match ? { finalUrl: match[1], finalUrlSuffix: match[2] } : { finalUrl: url, finalUrlSuffix: null };
}

// 将更新后的链接数组重新写入 Drive 文件
function updateDriveFile(filename, urlArray) {
  try {
    var files = DriveApp.getFilesByName(filename);
    if (!files.hasNext()) {
      Logger.log("❌ 无法找到原文件以更新内容");
      return;
    }
    var file = files.next();
    var newContent = urlArray.join('\n');
    file.setContent(newContent);
  } catch (e) {
    Logger.log("❌ 写入文件失败: " + e.toString());
  }
}
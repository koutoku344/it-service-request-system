# CloudWatch Agent

監視対象：
- application Docker log
- nginx Docker log
- OS system log
- memory utilization
- root filesystem utilization

Docker json-fileのLogPathはコンテナに依存するため、
EC2上で docker inspect により取得してAgent設定へ反映する。

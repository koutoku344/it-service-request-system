terraform {
  backend "s3" {
    bucket       = "koutoku-inquiry-system-tfstate-006635110954"
    key          = "it-service-request-system/dev/terraform.tfstate"
    region       = "ap-northeast-1"
    profile      = "terraform-dev"
    encrypt      = true
    use_lockfile = true
  }
}

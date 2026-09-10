<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

/** Raised when the markup asks for something the vocabulary does not define, such as a `data-fs-type` outside the catalog. */
final class AuthoringError extends \LogicException
{
}

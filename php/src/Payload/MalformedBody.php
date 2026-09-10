<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Payload;

/** A request body the submission protocol does not describe, such as a JSON body that carries a key for a file field. */
final class MalformedBody extends \InvalidArgumentException
{
}
